import os
import re
from langchain_core.tools import tool


def _derive_title(filename: str, content: str) -> str:
    """Extract title from first H1 heading, or fall back to filename."""
    for line in content.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return filename.removesuffix(".md").replace("-", " ").replace("_", " ").title()


def _content_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    return {"md": "markdown", "json": "json", "txt": "text"}.get(ext, "text")


@tool
async def store_result(filename: str, content: str, task_id: str = "", source: str = "") -> str:
    """
    Persist a completed artefact (document, report, post) to Supabase.
    filename: intended filename including extension (e.g. 'campaign_brief_2025.md')
    content: full content of the artefact
    task_id: optional task identifier for audit trail
    source: origin channel — 'slack', 'chat', 'scheduled', etc.
    """
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    employee_id = os.getenv("EMPLOYEE_ID", "employee")

    if not url or not key:
        return "Error: Supabase credentials not configured"

    client = create_client(url, key)

    row = {
        "employee_id": employee_id,
        "filename":    filename,
        "title":       _derive_title(filename, content),
        "content":     content,
        "content_type": _content_type(filename),
        "task_id":     task_id or None,
        "source":      source or None,
    }

    result = client.table("artefacts").insert(row).execute()

    if result.data:
        artefact_id = result.data[0]["id"]
        return f"Artefact stored in Supabase: {filename} (id: {artefact_id})"

    return f"Artefact stored: {filename}"
