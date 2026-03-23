"""
Meetings Monitor agent.

Responsibilities:
  1. Track which agenda items are being addressed as the transcript flows
  2. At end of meeting: generate full Minutes of Meeting (MoM)

Agenda tracking runs on every utterance. The LLM determines which agenda item
(if any) the utterance is addressing and updates meeting_agenda_status.

MoM generation is triggered explicitly when the session ends.
"""
import json
import logging
from pydantic import BaseModel, Field
from agent.config_loader import load_agent_config
from agent.llm_selector import get_llm
from agent.tools.update_agenda import upsert_agenda_status, get_agenda_status
from agent.tools.write_mom import write_mom

logger = logging.getLogger(__name__)

AGENT_ID = "meetings-monitor"


class AgendaClassification(BaseModel):
    matched_sequence: int = Field(
        default=-1,
        description="Sequence number of the agenda item being addressed, or -1 if none",
    )
    new_status: str = Field(
        default="pending",
        description="One of: pending, in_progress, completed, skipped",
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class MeetingsMonitorAgent:
    def __init__(self):
        config = load_agent_config(AGENT_ID)
        self._personality = config.personality_md
        reason_model = config.llm_overrides.get("reason", "gemini-3.1-pro-preview")
        write_model = config.llm_overrides.get("write", "gemini-3-flash-preview")
        self._classifier = get_llm(reason_model).with_structured_output(AgendaClassification)
        self._writer = get_llm(write_model)

    async def process(
        self,
        meeting_id: str,
        utterance: dict,
        agenda: list[dict],
    ) -> None:
        """
        Called for every transcript utterance.
        agenda: list of {"sequence": int, "text": str} from meetings.agenda JSONB.
        """
        if not agenda:
            return

        text = utterance.get("text", "").strip()
        if not text:
            return

        agenda_list = "\n".join(
            f"{item['sequence']}. {item['text']}" for item in agenda
        )

        prompt = f"""{self._personality}

You are tracking the agenda of a live meeting. Given the utterance below, identify which agenda item (if any) is currently being discussed. Update its status accordingly.

Agenda items:
{agenda_list}

Utterance: \"{text}\"

Rules:
- matched_sequence: the sequence number of the item being discussed, or -1 if none
- new_status: 'in_progress' if the topic is being introduced/discussed, 'completed' if it has been resolved/closed, 'skipped' if it was explicitly skipped
- Only mark 'completed' if there is clear resolution language ("we've decided", "that's settled", "moving on from X")
- confidence: your certainty that this mapping is correct

Respond with structured output only."""

        try:
            result: AgendaClassification = await self._classifier.ainvoke(prompt)
        except Exception as e:
            logger.warning("Agenda classification LLM error: %s", e)
            return

        if result.matched_sequence == -1 or result.confidence < 0.65:
            return

        matched_item = next(
            (item for item in agenda if item["sequence"] == result.matched_sequence),
            None,
        )
        if not matched_item:
            return

        try:
            await upsert_agenda_status(
                meeting_id=meeting_id,
                agenda_sequence=result.matched_sequence,
                agenda_item_text=matched_item["text"],
                status=result.new_status,
            )
        except Exception as e:
            logger.error("Failed to update agenda status: %s", e)

    async def generate_mom(
        self,
        meeting_id: str,
        meeting_title: str,
        agenda: list[dict],
        decisions: list[dict],
        qa_pairs: list[dict],
        transcript_summary: str,
    ) -> None:
        """
        Generate and store Minutes of Meeting. Called when a meeting ends.

        decisions: list of {decision_text, logged_at}
        qa_pairs: list of {question_text, answer_text, question_source}
        transcript_summary: last N utterances joined as plain text (provided by session)
        """
        agenda_status = await get_agenda_status(meeting_id)

        agenda_section = "\n".join(
            f"- [{row['status'].upper()}] {row['agenda_item_text']}"
            for row in agenda_status
        ) or "_(No agenda items tracked)_"

        decisions_section = "\n".join(
            f"- {d['decision_text']}"
            for d in decisions
        ) or "_(No decisions logged)_"

        qa_section = "\n".join(
            f"- **Q:** {qa['question_text']}\n  **A:** {qa.get('answer_text', '_(unanswered)_')}"
            for qa in qa_pairs
            if qa.get("answered")
        ) or "_(No Q&A recorded)_"

        prompt = f"""{self._personality}

You are writing the Minutes of Meeting for a concluded meeting.

Meeting: {meeting_title}

## Agenda outcome
{agenda_section}

## Decisions made
{decisions_section}

## Questions & answers
{qa_section}

## Meeting excerpt (final transcript)
{transcript_summary}

Write complete, professional Minutes of Meeting in Markdown format. Include:
1. Meeting overview (title, brief purpose inferred from context)
2. Agenda items with outcome (addressed / not addressed)
3. Key decisions
4. Action items with owners and due dates if mentioned
5. Any open questions or items to follow up

Be concise and factual. Do not invent information not present in the transcript."""

        try:
            response = await self._writer.ainvoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            mom_id = await write_mom(meeting_id, content)
            logger.info("MoM written (id=%s) for meeting %s", mom_id, meeting_id)
        except Exception as e:
            logger.error("Failed to generate MoM: %s", e)
