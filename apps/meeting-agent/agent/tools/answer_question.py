"""Writes a Q&A pair to meeting_qa_pairs."""
from datetime import datetime, timezone
from agent.tools.supabase_client import get_client


async def create_question(
    meeting_id: str,
    question_text: str,
    question_source: str,
) -> str:
    """Insert an unanswered question row and return its ID."""
    db = get_client()
    row = {
        "meeting_id": meeting_id,
        "question_text": question_text,
        "question_source": question_source,
        "answered": False,
        "agent_id": "qa-agent",
        "asked_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.table("meeting_qa_pairs").insert(row).execute()
    if result.data:
        return result.data[0]["id"]
    raise RuntimeError(f"Failed to insert question: {result}")


async def answer_question(
    qa_id: str,
    answer_text: str,
    artefact_refs: list[str],
) -> None:
    """Update an existing Q&A pair with the answer."""
    db = get_client()
    db.table("meeting_qa_pairs").update({
        "answer_text": answer_text,
        "artefact_refs": artefact_refs,
        "answered": True,
        "answered_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", qa_id).execute()
