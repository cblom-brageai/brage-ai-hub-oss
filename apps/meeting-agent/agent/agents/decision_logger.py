"""
Decision Logger agent.

Receives each finalized transcript utterance and determines whether it
contains a decision. If it does, logs it to meeting_decisions via Supabase
(triggers Realtime to the Chrome extension).

Uses structured output for reliable detection rather than a full agent loop.
"""
import logging
from pydantic import BaseModel, Field
from agent.config_loader import load_agent_config
from agent.llm_selector import get_llm
from agent.tracing import run_config
from agent.tools.log_decision import log_decision

logger = logging.getLogger(__name__)

AGENT_ID = "decision-logger"
CONFIDENCE_THRESHOLD = 0.65


class DecisionDetection(BaseModel):
    is_decision: bool = Field(description="True if a clear decision was made in this utterance")
    decision_text: str = Field(default="", description="Concise statement of the decision (empty if none)")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confidence 0.0–1.0")


class DecisionLoggerAgent:
    def __init__(self):
        config = load_agent_config(AGENT_ID)
        self._personality = config.personality_md
        reason_model = config.llm_overrides.get("reason", "gemini-3.1-pro-preview")
        self._llm = get_llm(reason_model, role="reason").with_structured_output(DecisionDetection)

    async def process(
        self, meeting_id: str, utterance: dict, context: list[dict] | None = None
    ) -> None:
        """
        utterance keys: text, speaker_label, sequence_number, language
        context: list of recent utterances preceding this one (for resolving references)
        """
        text = utterance.get("text", "").strip()
        if not text:
            return

        speaker = utterance.get("speaker_label") or f"Speaker {utterance.get('speaker_id', '?')}"
        sequence = utterance.get("sequence_number", 0)

        context_block = ""
        if context:
            lines = [
                f"{u.get('speaker_label') or 'Speaker'}: {u.get('text', '')}"
                for u in context
                if u.get("text", "").strip()
            ]
            if lines:
                context_block = "\n\nRecent conversation context:\n" + "\n".join(lines) + "\n"

        prompt = f"""{self._personality}

You are listening to a live meeting transcript. Analyse the following utterance and determine whether it contains a clear decision.

A decision is: a commitment to a course of action, an agreement, or an explicit choice between alternatives that has been resolved.{context_block}

Current utterance (by {speaker}):
\"{text}\"

Respond with structured output only."""

        try:
            result: DecisionDetection = await self._llm.ainvoke(
                prompt, config=run_config(AGENT_ID, meeting_id, "detect-decision")
            )
        except Exception as e:
            logger.warning("Decision detection LLM error: %s", e)
            return

        if result.is_decision and result.decision_text and result.confidence >= CONFIDENCE_THRESHOLD:
            try:
                decision_id = await log_decision(
                    meeting_id=meeting_id,
                    decision_text=result.decision_text,
                    context_quote=text,
                    triggered_at_sequence=sequence,
                    confidence=result.confidence,
                )
                logger.info("Decision logged (id=%s) for meeting %s", decision_id, meeting_id)
            except Exception as e:
                logger.error("Failed to log decision: %s", e)
