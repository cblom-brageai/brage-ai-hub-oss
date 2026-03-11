import os
from pathlib import Path
from langchain_core.tools import tool


@tool
async def store_result(filename: str, content: str, task_id: str = "") -> str:
    """
    Persist a completed artefact (document, report, post) to the artefacts directory.
    filename: target filename including extension (e.g. 'campaign_brief_2025.md')
    content: full content of the artefact
    task_id: optional task identifier for audit trail
    """
    artefacts_dir = Path(os.getenv("FS_ROOT", "/app/config/artefacts"))
    artefacts_dir.mkdir(parents=True, exist_ok=True)

    path = artefacts_dir / filename
    path.write_text(content)

    return f"Artefact saved: {filename}"
