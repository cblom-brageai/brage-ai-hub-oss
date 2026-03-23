"""
MeetingSession — manages the lifecycle of one active meeting.

Responsibilities:
  - Load meeting data (participants, agenda) from Supabase on start
  - Fan out each utterance to all active agents simultaneously
  - Route to employees when directly addressed by name
  - Maintain a rolling transcript buffer for MoM generation
  - Trigger MoM generation on end
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx

from agent.agents.decision_logger import DecisionLoggerAgent
from agent.agents.qa_agent import QAAgent
from agent.agents.meetings_monitor import MeetingsMonitorAgent
from agent.tools.supabase_client import get_client

logger = logging.getLogger(__name__)

# Max utterances kept in memory for MoM transcript summary
_TRANSCRIPT_BUFFER_SIZE = 200

# Rolling window fed to MoM (last N utterances as plain text)
_MOM_TRANSCRIPT_LINES = 100


def _employee_display_name(employee_id: str) -> str:
    """'marketing-manager' → 'Marketing Manager'"""
    return employee_id.replace("-", " ").title()


def _employee_url(employee_id: str) -> str | None:
    raw = os.getenv("EMPLOYEE_AGENT_URLS", "{}")
    try:
        urls = json.loads(raw)
        return urls.get(employee_id)
    except Exception:
        return None


class MeetingSession:
    def __init__(self, meeting_id: str, meeting_data: dict):
        self.meeting_id = meeting_id
        self.title: str = meeting_data.get("title", "Untitled Meeting")
        self.agenda: list[dict] = meeting_data.get("agenda") or []
        self.language_hints: list[str] = meeting_data.get("language_hints") or ["en"]

        # Participants loaded from meeting_participants table
        self._agent_participants: list[str] = []   # built-in agent IDs
        self._employee_participants: list[str] = [] # employee IDs

        # Agent instances
        self._decision_logger: DecisionLoggerAgent | None = None
        self._qa_agent: QAAgent | None = None
        self._monitor: MeetingsMonitorAgent | None = None

        # Rolling transcript buffer
        self._transcript: list[dict] = []

    async def start(self) -> None:
        """Load participants and instantiate agents."""
        db = get_client()
        result = (
            db.table("meeting_participants")
            .select("participant_type, participant_id, active")
            .eq("meeting_id", self.meeting_id)
            .eq("active", True)
            .execute()
        )
        for row in result.data or []:
            if row["participant_type"] == "agent":
                self._agent_participants.append(row["participant_id"])
            elif row["participant_type"] == "employee":
                self._employee_participants.append(row["participant_id"])

        # Instantiate only the agents that are assigned to this meeting
        if "decision-logger" in self._agent_participants:
            self._decision_logger = DecisionLoggerAgent()
        if "qa-agent" in self._agent_participants:
            self._qa_agent = QAAgent()
        if "meetings-monitor" in self._agent_participants:
            self._monitor = MeetingsMonitorAgent()

        # Mark meeting as active in Supabase
        db.table("meetings").update({
            "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", self.meeting_id).execute()

        logger.info(
            "Meeting %s started. Agents: %s  Employees: %s",
            self.meeting_id,
            self._agent_participants,
            self._employee_participants,
        )

    async def process_utterance(self, utterance: dict) -> None:
        """
        Receive a finalized Soniox utterance and fan out to all active agents.
        Also checks if any employee is directly addressed.
        """
        # Buffer utterance for MoM
        self._transcript.append(utterance)
        if len(self._transcript) > _TRANSCRIPT_BUFFER_SIZE:
            self._transcript.pop(0)

        # Build fan-out coroutines
        tasks: list = []

        if self._decision_logger:
            tasks.append(self._decision_logger.process(self.meeting_id, utterance))

        if self._qa_agent:
            tasks.append(self._qa_agent.process(self.meeting_id, utterance))

        if self._monitor:
            tasks.append(self._monitor.process(self.meeting_id, utterance, self.agenda))

        # Employee routing — only when directly addressed by name
        for employee_id in self._employee_participants:
            name = _employee_display_name(employee_id)
            if name.lower() in utterance.get("text", "").lower():
                tasks.append(self._forward_to_employee(employee_id, utterance))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    logger.error("Agent task error: %s", r)

    async def process_chat(self, message: str) -> None:
        """Route a chat message from the extension to the Q&A agent."""
        if self._qa_agent:
            await self._qa_agent.process_chat(self.meeting_id, message)

    async def end(self) -> None:
        """End the meeting: generate MoM, update status."""
        db = get_client()

        if self._monitor:
            # Collect decisions and Q&A for MoM
            decisions_result = (
                db.table("meeting_decisions")
                .select("decision_text, logged_at")
                .eq("meeting_id", self.meeting_id)
                .order("logged_at")
                .execute()
            )
            qa_result = (
                db.table("meeting_qa_pairs")
                .select("question_text, answer_text, question_source, answered")
                .eq("meeting_id", self.meeting_id)
                .order("asked_at")
                .execute()
            )

            # Build transcript summary from the last N buffered utterances
            recent = self._transcript[-_MOM_TRANSCRIPT_LINES:]
            transcript_summary = "\n".join(
                f"{u.get('speaker_label') or 'Speaker'}: {u.get('text', '')}"
                for u in recent
            )

            await self._monitor.generate_mom(
                meeting_id=self.meeting_id,
                meeting_title=self.title,
                agenda=self.agenda,
                decisions=decisions_result.data or [],
                qa_pairs=qa_result.data or [],
                transcript_summary=transcript_summary,
            )

        db.table("meetings").update({
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", self.meeting_id).execute()

        logger.info("Meeting %s ended.", self.meeting_id)

    async def _forward_to_employee(self, employee_id: str, utterance: dict) -> None:
        """
        Forward an utterance to an employee agent and store the response
        as a Q&A pair so it appears in the extension chat.
        """
        url = _employee_url(employee_id)
        if not url:
            logger.warning("No URL configured for employee %s", employee_id)
            return

        speaker = utterance.get("speaker_label") or f"Speaker {utterance.get('speaker_id', '?')}"
        message = f"[meeting: {self.title}] {speaker} said: \"{utterance['text']}\""

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{url}/chat/{employee_id}",
                    json={"message": message},
                )
                resp.raise_for_status()
                answer = resp.json().get("response", "")
        except Exception as e:
            logger.error("Employee %s request failed: %s", employee_id, e)
            return

        if not answer:
            return

        # Store as a Q&A pair so it surfaces in the extension chat feed
        from agent.tools.answer_question import create_question, answer_question
        try:
            qa_id = await create_question(
                meeting_id=self.meeting_id,
                question_text=utterance["text"],
                question_source="transcript",
            )
            await answer_question(
                qa_id=qa_id,
                answer_text=f"**{_employee_display_name(employee_id)}:** {answer}",
                artefact_refs=[],
            )
        except Exception as e:
            logger.error("Failed to store employee response as Q&A: %s", e)
