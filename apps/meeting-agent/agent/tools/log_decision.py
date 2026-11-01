"""Writes a detected decision to meeting_decisions."""
from datetime import datetime, timezone
from agent.tools.supabase_client import get_client


async def log_decision(
    meeting_id: str,
    decision_text: str,
    context_quote: str,
    triggered_at_sequence: int,
    confidence: float,
) -> str:
    db = get_client()
    row = {
        "meeting_id": meeting_id,
        "decision_text": decision_text,
        "context_quote": context_quote,
        "triggered_at_sequence": triggered_at_sequence,
        "confidence": round(confidence, 2),
        "agent_id": "decision-logger",
        "logged_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.table("meeting_decisions").insert(row).execute()
    if result.data:
        return result.data[0]["id"]
    raise RuntimeError(f"Failed to insert decision: {result}")
