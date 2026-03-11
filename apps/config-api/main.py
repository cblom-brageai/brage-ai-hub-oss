"""
Config API — serves and saves employee config files.
Mounts the same ./employees/ directory as employee containers.
"""
import os
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

ALLOWED_FILES = {"Strategy.md", "Skills.md", "Personality.md"}


def employee_dir(employee_id: str) -> Path:
    path = CONFIG_ROOT / employee_id / "config"
    path.mkdir(parents=True, exist_ok=True)
    return path


class FileSaveRequest(BaseModel):
    content: str
    reload: bool = False


@app.get("/config/{employee_id}/files")
def list_files(employee_id: str):
    d = employee_dir(employee_id)
    return [
        {"name": f.name, "last_modified": f.stat().st_mtime}
        for f in d.iterdir()
        if f.is_file() and f.name in ALLOWED_FILES
    ]


@app.get("/config/{employee_id}/file/{filename}")
def get_file(employee_id: str, filename: str):
    if filename not in ALLOWED_FILES:
        raise HTTPException(404, "File not found")
    path = employee_dir(employee_id) / filename
    if not path.exists():
        return {"content": "", "last_modified": None}
    return {"content": path.read_text(), "last_modified": path.stat().st_mtime}


@app.put("/config/{employee_id}/file/{filename}")
def save_file(employee_id: str, filename: str, req: FileSaveRequest):
    if filename not in ALLOWED_FILES:
        raise HTTPException(400, "Invalid filename")
    path = employee_dir(employee_id) / filename
    path.write_text(req.content)

    reloaded = False
    if req.reload:
        reloaded = _reload_employee(employee_id)

    if GIT_ENABLED:
        _git_commit(employee_id, filename)

    return {"saved": True, "reloaded": reloaded}


@app.post("/config/{employee_id}/reload")
def reload_employee(employee_id: str):
    reloaded = _reload_employee(employee_id)
    return {"reloaded": reloaded}


@app.get("/health")
def health():
    return {"status": "ok"}


def _reload_employee(employee_id: str) -> bool:
    container = f"employee-{employee_id}"
    result = subprocess.run(
        ["docker", "kill", "--signal", "SIGHUP", container],
        capture_output=True,
    )
    return result.returncode == 0


def _git_commit(employee_id: str, filename: str):
    try:
        import git
        repo = git.Repo(CONFIG_ROOT, search_parent_directories=True)
        path = employee_dir(employee_id) / filename
        repo.index.add([str(path)])
        author = git.Actor(
            os.getenv("GIT_AUTHOR_NAME", "Brage Config API"),
            os.getenv("GIT_AUTHOR_EMAIL", "config-api@brageai.no"),
        )
        repo.index.commit(f"Update {filename} for {employee_id}", author=author, committer=author)
    except Exception as e:
        print(f"Git commit failed: {e}")
