"""Writes or updates Minutes of Meeting in meeting_mom."""
from datetime import datetime, timezone
from agent.tools.supabase_client import get_client


async def write_mom(meeting_id: str, content: str) -> str:
    """
    Insert a new MoM version. Version number is auto-incremented
    (latest version + 1, or 1 if none exist).
    Returns the new MoM row ID.
    """
    db = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Get the current max version
    existing = (
        db.table("meeting_mom")
        .select("version")
        .eq("meeting_id", meeting_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing.data[0]["version"] + 1) if existing.data else 1

    result = db.table("meeting_mom").insert({
        "meeting_id": meeting_id,
        "content": content,
        "version": next_version,
        "agent_id": "meetings-monitor",
        "generated_at": now,
    }).execute()

    if result.data:
        return result.data[0]["id"]
    raise RuntimeError(f"Failed to write MoM: {result}")
