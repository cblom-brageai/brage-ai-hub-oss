"""
Full-text search across company artefacts in Supabase.
Used by the Q&A agent to find relevant documents when answering questions.
"""
from agent.tools.supabase_client import get_client


async def search_artefacts(query: str, limit: int = 5) -> list[dict]:
    """
    Search artefacts by title and content using Supabase full-text search.
    Returns a list of {id, title, filename, snippet} dicts.
    """
    db = get_client()

    # Use Supabase text search (PostgreSQL tsvector)
    result = (
        db.table("artefacts")
        .select("id, title, filename, content, employee_id, created_at")
        .text_search("content", query, config="english")
        .limit(limit)
        .execute()
    )

    if not result.data:
        # Fallback: ilike search on title
        result = (
            db.table("artefacts")
            .select("id, title, filename, content, employee_id, created_at")
            .ilike("title", f"%{query}%")
            .limit(limit)
            .execute()
        )

    hits = []
    for row in result.data or []:
        # Trim content to a relevant snippet (first 400 chars)
        content = row.get("content", "")
        snippet = content[:400].strip() + ("…" if len(content) > 400 else "")
        hits.append({
            "id": row["id"],
            "title": row["title"],
            "filename": row["filename"],
            "snippet": snippet,
            "employee_id": row.get("employee_id"),
        })

    return hits
