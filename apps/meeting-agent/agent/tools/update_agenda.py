"""Upserts agenda item status rows for meetings-monitor."""
from datetime import datetime, timezone
from agent.tools.supabase_client import get_client


async def upsert_agenda_status(
    meeting_id: str,
    agenda_sequence: int,
    agenda_item_text: str,
    status: str,
) -> None:
    """
    Insert or update the status of a single agenda item.
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
    """
    db = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Check if row exists
    existing = (
        db.table("meeting_agenda_status")
        .select("id, status, first_addressed_at")
        .eq("meeting_id", meeting_id)
        .eq("agenda_sequence", agenda_sequence)
        .maybe_single()
        .execute()
    )

    if existing.data:
        update = {"status": status, "updated_at": now}
        # Set first_addressed_at only on first transition away from 'pending'
        if status != "pending" and not existing.data.get("first_addressed_at"):
            update["first_addressed_at"] = now
        db.table("meeting_agenda_status").update(update).eq(
            "id", existing.data["id"]
        ).execute()
    else:
        db.table("meeting_agenda_status").insert({
            "meeting_id": meeting_id,
            "agenda_sequence": agenda_sequence,
            "agenda_item_text": agenda_item_text,
            "status": status,
            "first_addressed_at": now if status != "pending" else None,
            "agent_id": "meetings-monitor",
            "updated_at": now,
        }).execute()


async def get_agenda_status(meeting_id: str) -> list[dict]:
    """Return current status for all agenda items in a meeting."""
    db = get_client()
    result = (
        db.table("meeting_agenda_status")
        .select("agenda_sequence, agenda_item_text, status, first_addressed_at")
        .eq("meeting_id", meeting_id)
        .order("agenda_sequence")
        .execute()
    )
    return result.data or []
