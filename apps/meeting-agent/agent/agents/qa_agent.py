"""
Q&A agent.

Handles two input types:
  1. Transcript utterances — detects questions asked aloud in the meeting
  2. Chat messages — questions typed into the extension chat by participants

For each question:
  - Searches company artefacts for relevant context
  - Generates an answer using the LLM
  - Writes the Q&A pair to meeting_qa_pairs (triggers Realtime to extension)
"""
import logging
from pydantic import BaseModel, Field
from agent.config_loader import load_agent_config
from agent.llm_selector import get_llm
from agent.tools.search_artefacts import search_artefacts
from agent.tools.answer_question import create_question, answer_question

logger = logging.getLogger(__name__)

AGENT_ID = "qa-agent"
CONFIDENCE_THRESHOLD = 0.7


class QuestionDetection(BaseModel):
    is_question: bool = Field(description="True if this utterance is asking a question")
    question_text: str = Field(default="", description="The extracted question (empty if none)")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class QAAgent:
    def __init__(self):
        config = load_agent_config(AGENT_ID)
        self._personality = config.personality_md
        reason_model = config.llm_overrides.get("reason", "gemini-3.1-pro-preview")
        write_model = config.llm_overrides.get("write", "gemini-3-flash-preview")
        self._detector = get_llm(reason_model).with_structured_output(QuestionDetection)
        self._writer = get_llm(write_model)

    async def process(self, meeting_id: str, utterance: dict) -> None:
        """Process a transcript utterance — detect and answer questions."""
        text = utterance.get("text", "").strip()
        if not text:
            return

        speaker = utterance.get("speaker_label") or f"Speaker {utterance.get('speaker_id', '?')}"

        detection_prompt = f"""{self._personality}

You are listening to a live meeting. Determine whether the following utterance contains a question that warrants an answer.

Ignore rhetorical questions and procedural questions ("shall we continue?", "can you hear me?").
Focus on questions that seek factual information or clarification about the company, projects, or topics.

Utterance (by {speaker}):
\"{text}\"

Respond with structured output only."""

        try:
            detection: QuestionDetection = await self._detector.ainvoke(detection_prompt)
        except Exception as e:
            logger.warning("Question detection LLM error: %s", e)
            return

        if not detection.is_question or not detection.question_text:
            return
        if detection.confidence < CONFIDENCE_THRESHOLD:
            return

        await self._answer(
            meeting_id=meeting_id,
            question_text=detection.question_text,
            question_source="transcript",
        )

    async def process_chat(self, meeting_id: str, message: str) -> None:
        """Process a question typed directly into the extension chat."""
        if not message.strip():
            return
        await self._answer(
            meeting_id=meeting_id,
            question_text=message.strip(),
            question_source="chat",
        )

    async def _answer(
        self,
        meeting_id: str,
        question_text: str,
        question_source: str,
    ) -> None:
        # Create unanswered row immediately (extension sees question appear)
        try:
            qa_id = await create_question(meeting_id, question_text, question_source)
        except Exception as e:
            logger.error("Failed to create question row: %s", e)
            return

        # Search artefacts for relevant context
        artefact_refs: list[str] = []
        context_block = ""
        try:
            hits = await search_artefacts(question_text, limit=4)
            if hits:
                artefact_refs = [h["id"] for h in hits]
                sections = "\n\n".join(
                    f"**{h['title']}** ({h['filename']}):\n{h['snippet']}"
                    for h in hits
                )
                context_block = f"\n\nRelevant company knowledge:\n{sections}"
        except Exception as e:
            logger.warning("Artefact search failed: %s", e)

        answer_prompt = f"""{self._personality}

A question has been asked during a meeting. Answer it concisely using the company knowledge provided.
If the knowledge is not sufficient, say so honestly rather than guessing.{context_block}

Question: {question_text}

Provide a direct, helpful answer (2–4 sentences). If using company documents, cite the source title."""

        try:
            response = await self._writer.ainvoke(answer_prompt)
            answer_text = response.content if hasattr(response, "content") else str(response)
        except Exception as e:
            logger.error("Answer generation LLM error: %s", e)
            answer_text = "_(Could not generate an answer at this time.)_"

        try:
            await answer_question(qa_id, answer_text, artefact_refs)
            logger.info("Q&A answered (id=%s) for meeting %s", qa_id, meeting_id)
        except Exception as e:
            logger.error("Failed to write answer: %s", e)
