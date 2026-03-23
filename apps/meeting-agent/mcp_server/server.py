"""
Meeting Agent FastAPI server.

Endpoints:
  POST /meetings/{id}/start       — activate a meeting session
  POST /meetings/{id}/end         — end session and generate MoM
  POST /meetings/{id}/utterance   — ingest a finalized Soniox utterance
  POST /meetings/{id}/chat        — process a chat message from the extension
  GET  /meetings/{id}/status      — return session status
  GET  /health
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent.tools.supabase_client import get_client
from agent.session import MeetingSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory session store  {meeting_id: MeetingSession}
_sessions: dict[str, MeetingSession] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Meeting agent service starting.")
    yield
    logger.info("Meeting agent service shutting down.")


app = FastAPI(title="Brage Meeting Agent", lifespan=lifespan)


# ── Request / Response models ─────────────────────────────────────────────────

class UtteranceRequest(BaseModel):
    speaker_id: int | None = None
    speaker_label: str | None = None
    text: str
    language: str | None = None
    timestamp_ms: int | None = None
    sequence_number: int


class ChatRequest(BaseModel):
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_session(meeting_id: str) -> MeetingSession:
    session = _sessions.get(meeting_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No active session for meeting {meeting_id}. Call /start first.",
        )
    return session


async def _load_meeting(meeting_id: str) -> dict:
    db = get_client()
    result = (
        db.table("meetings")
        .select("id, title, description, status, agenda, language_hints")
        .eq("id", meeting_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Meeting {meeting_id} not found in database.")
    return result.data


async def _persist_utterance(meeting_id: str, req: UtteranceRequest) -> None:
    db = get_client()
    db.table("meeting_transcriptions").insert({
        "meeting_id": meeting_id,
        "speaker_id": req.speaker_id,
        "speaker_label": req.speaker_label,
        "text": req.text,
        "language": req.language,
        "timestamp_ms": req.timestamp_ms,
        "sequence_number": req.sequence_number,
    }).execute()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/meetings/{meeting_id}/start")
async def start_meeting(meeting_id: str):
    if meeting_id in _sessions:
        return {"status": "already_active", "meeting_id": meeting_id}

    meeting_data = await _load_meeting(meeting_id)

    if meeting_data["status"] not in ("scheduled", "active"):
        raise HTTPException(
            status_code=400,
            detail=f"Meeting status is '{meeting_data['status']}' — cannot start.",
        )

    session = MeetingSession(meeting_id, meeting_data)
    await session.start()
    _sessions[meeting_id] = session

    return {"status": "started", "meeting_id": meeting_id, "title": session.title}


@app.post("/meetings/{meeting_id}/utterance")
async def ingest_utterance(meeting_id: str, req: UtteranceRequest):
    session = _get_session(meeting_id)

    # Persist raw transcription to Supabase (Realtime triggers extension transcript feed)
    await _persist_utterance(meeting_id, req)

    # Fan out to agents (fire-and-forget — don't block the response)
    import asyncio
    asyncio.create_task(session.process_utterance(req.model_dump()))

    return {"status": "ok", "sequence_number": req.sequence_number}


@app.post("/meetings/{meeting_id}/chat")
async def chat_message(meeting_id: str, req: ChatRequest):
    session = _get_session(meeting_id)
    import asyncio
    asyncio.create_task(session.process_chat(req.message))
    return {"status": "ok"}


@app.post("/meetings/{meeting_id}/end")
async def end_meeting(meeting_id: str):
    session = _get_session(meeting_id)
    await session.end()
    del _sessions[meeting_id]
    return {"status": "ended", "meeting_id": meeting_id}


@app.get("/meetings/{meeting_id}/status")
async def meeting_status(meeting_id: str):
    if meeting_id not in _sessions:
        return {"active": False, "meeting_id": meeting_id}
    session = _sessions[meeting_id]
    return {
        "active": True,
        "meeting_id": meeting_id,
        "title": session.title,
        "utterances_buffered": len(session._transcript),
    }


@app.get("/health")
async def health():
    return {"status": "ok", "active_sessions": len(_sessions)}
