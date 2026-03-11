"""
Config API — serves and saves employee config files.
Layout per employee: /employees/<id>/config/
  Strategy.md        — single file
  Personality.md     — single file
  agent.config.md    — machine-readable: [mcp_servers], [llm_overrides], [human_gate]
  skills/            — one .md file per skill (5-10 per employee)
    content-creation.md
    campaign-management.md
    ...
"""
import os
import re
import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Brage Config API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_ROOT = Path(os.getenv("CONFIG_ROOT", "/employees"))
GIT_ENABLED = os.getenv("GIT_ENABLED", "false").lower() == "true"

CORE_FILES = {"Strategy.md", "Personality.md", "agent.config.md"}
_SAFE_NAME = re.compile(r'^[\w\-]+\.md$')


def employee_dir(employee_id: str) -> Path:
    path = CONFIG_ROOT / employee_id / "config"
    path.mkdir(parents=True, exist_ok=True)
    return path


def skills_dir(employee_id: str) -> Path:
    path = employee_dir(employee_id) / "skills"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_filename(name: str) -> bool:
    return bool(_SAFE_NAME.match(name))


class FileSaveRequest(BaseModel):
    content: str
    reload: bool = False


# ── Core files (Strategy, Personality, agent.config) ─────────────────────────

@app.get("/config/{employee_id}/files")
def list_core_files(employee_id: str):
    d = employee_dir(employee_id)
    return [
        {"name": f.name, "last_modified": f.stat().st_mtime}
        for f in d.iterdir()
        if f.is_file() and f.name in CORE_FILES
    ]


@app.get("/config/{employee_id}/file/{filename}")
def get_core_file(employee_id: str, filename: str):
    if filename not in CORE_FILES:
        raise HTTPException(404, "File not found")
    path = employee_dir(employee_id) / filename
    if not path.exists():
        return {"content": "", "last_modified": None}
    return {"content": path.read_text(), "last_modified": path.stat().st_mtime}


@app.put("/config/{employee_id}/file/{filename}")
def save_core_file(employee_id: str, filename: str, req: FileSaveRequest):
    if filename not in CORE_FILES:
        raise HTTPException(400, "Invalid filename")
    path = employee_dir(employee_id) / filename
    path.write_text(req.content)
    reloaded = _reload_employee(employee_id) if req.reload else False
    if GIT_ENABLED:
        _git_commit(employee_id, str(path))
    return {"saved": True, "reloaded": reloaded}


# ── Skills directory ──────────────────────────────────────────────────────────

@app.get("/config/{employee_id}/skills")
def list_skills(employee_id: str):
    d = skills_dir(employee_id)
    return sorted(
        [{"name": f.name, "last_modified": f.stat().st_mtime}
         for f in d.iterdir() if f.is_file() and f.suffix == ".md"],
        key=lambda x: x["name"],
    )


@app.get("/config/{employee_id}/skill/{skill_name}")
def get_skill(employee_id: str, skill_name: str):
    if not _safe_filename(skill_name):
        raise HTTPException(400, "Invalid skill filename")
    path = skills_dir(employee_id) / skill_name
    if not path.exists():
        return {"content": "", "last_modified": None}
    return {"content": path.read_text(), "last_modified": path.stat().st_mtime}


@app.put("/config/{employee_id}/skill/{skill_name}")
def save_skill(employee_id: str, skill_name: str, req: FileSaveRequest):
    if not _safe_filename(skill_name):
        raise HTTPException(400, "Invalid skill filename")
    path = skills_dir(employee_id) / skill_name
    path.write_text(req.content)
    reloaded = _reload_employee(employee_id) if req.reload else False
    if GIT_ENABLED:
        _git_commit(employee_id, str(path))
    return {"saved": True, "reloaded": reloaded}


@app.post("/config/{employee_id}/skill")
def create_skill(employee_id: str, req: FileSaveRequest, skill_name: str):
    if not _safe_filename(skill_name):
        raise HTTPException(400, "Invalid skill filename")
    path = skills_dir(employee_id) / skill_name
    if path.exists():
        raise HTTPException(409, "Skill already exists")
    path.write_text(req.content)
    return {"created": True, "name": skill_name}


@app.delete("/config/{employee_id}/skill/{skill_name}")
def delete_skill(employee_id: str, skill_name: str):
    if not _safe_filename(skill_name):
        raise HTTPException(400, "Invalid skill filename")
    path = skills_dir(employee_id) / skill_name
    if not path.exists():
        raise HTTPException(404, "Skill not found")
    path.unlink()
    return {"deleted": True}


# ── Reload & health ───────────────────────────────────────────────────────────

@app.post("/config/{employee_id}/reload")
def reload_employee_endpoint(employee_id: str):
    return {"reloaded": _reload_employee(employee_id)}


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reload_employee(employee_id: str) -> bool:
    container = f"employee-{employee_id}"
    result = subprocess.run(
        ["docker", "kill", "--signal", "SIGHUP", container],
        capture_output=True,
    )
    return result.returncode == 0


def _git_commit(employee_id: str, filepath: str):
    try:
        import git
        repo = git.Repo(CONFIG_ROOT, search_parent_directories=True)
        repo.index.add([filepath])
        author = git.Actor(
            os.getenv("GIT_AUTHOR_NAME", "Brage Config API"),
            os.getenv("GIT_AUTHOR_EMAIL", "config-api@brageai.no"),
        )
        filename = Path(filepath).name
        repo.index.commit(f"Update {filename} for {employee_id}", author=author, committer=author)
    except Exception as e:
        print(f"Git commit failed: {e}")
