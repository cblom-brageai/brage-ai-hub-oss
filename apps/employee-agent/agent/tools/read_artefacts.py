import os
import re
from langchain_core.tools import tool

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def _supabase_client():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("Supabase credentials not configured (SUPABASE_URL / SUPABASE_KEY)")
    return create_client(url, key)


@tool
async def list_artefacts(limit: int = 20) -> str:
    """
    List artefacts (documents, reports, posts) that this employee has previously produced.
    Returns id, filename, title, and creation date for each.
    Use this to find past work before reading specific content with read_artefact.
    limit: how many recent artefacts to return (default 20, max 50)
    """
    employee_id = os.getenv("EMPLOYEE_ID", "employee")
    try:
        client = _supabase_client()
    except RuntimeError as e:
        return str(e)

    result = (
        client.table("artefacts")
        .select("id, filename, title, created_at, source, task_id")
        .eq("employee_id", employee_id)
        .order("created_at", desc=True)
        .limit(min(limit, 50))
        .execute()
    )

    if not result.data:
        return "No artefacts found. You have not stored any documents yet."

    lines = [f"Found {len(result.data)} artefact(s) for {employee_id}:\n"]
    for row in result.data:
        created = (row.get("created_at") or "")[:10] or "unknown"
        source_str = f"  [{row['source']}]" if row.get("source") else ""
        lines.append(
            f"- \"{row['title']}\"  |  {row['filename']}  |  {created}{source_str}  |  id:{row['id']}"
        )

    return "\n".join(lines)


@tool
async def read_artefact(filename_or_id: str) -> str:
    """
    Read the full content of a previously stored artefact by filename or UUID.
    filename_or_id: exact filename (e.g. 'campaign_brief_2025.md') or the UUID shown by list_artefacts.
    When multiple files share a name, the most recent is returned.
    """
    employee_id = os.getenv("EMPLOYEE_ID", "employee")
    try:
        client = _supabase_client()
    except RuntimeError as e:
        return str(e)

    q = client.table("artefacts").select("*").eq("employee_id", employee_id)

    if _UUID_RE.match(filename_or_id.strip()):
        q = q.eq("id", filename_or_id.strip())
    else:
        q = q.eq("filename", filename_or_id.strip()).order("created_at", desc=True)

    result = q.limit(1).execute()

    if not result.data:
        return f"No artefact found with filename or id: {filename_or_id!r}"

    row = result.data[0]
    created = (row.get("created_at") or "")[:10] or "unknown"
    source = row.get("source") or "unknown"

    header = f"# {row['title']}\n\n_File: {row['filename']} | Stored: {created} | Source: {source}_\n\n---\n\n"
    return header + row["content"]
