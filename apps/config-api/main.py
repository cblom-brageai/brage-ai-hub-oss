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
import io
import logging
import os
import re
import subprocess
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from slack_router import start_slack_router
    from scheduler import start_scheduler
    start_slack_router()
    start_scheduler()
    yield


app = FastAPI(title="Brage Config API", lifespan=lifespan)

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


# ── Task CRUD ─────────────────────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    title: str
    description: str = ""
    assigned_to: str = ""
    recurrence: str = ""
    scheduled_at: str = ""
    created_by: str = "agent"
    template_id: str = ""


class PublishChannelRequest(BaseModel):
    name: str = ""
    type: str = ""
    config: dict = {}
    available_to: list = []


class PublishRuleRequest(BaseModel):
    employee_id: str
    channel_id: str
    trigger: str = "approved"


class PublishRequest(BaseModel):
    artefact_id: str
    channel_id: str


@app.post("/tasks")
def create_task_endpoint(req: TaskCreateRequest):
    from task_store import create_task
    task = create_task(
        title=req.title,
        description=req.description,
        assigned_to=req.assigned_to,
        created_by=req.created_by,
        recurrence=req.recurrence,
        scheduled_at=req.scheduled_at,
    )
    if not task:
        raise HTTPException(500, "Failed to create task")
    return task


# ── Task delegation & completion ─────────────────────────────────────────────

@app.post("/tasks/{task_id}/delegate")
def delegate_task(task_id: str):
    from task_store import get_task, update_task
    task = get_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if not task.get("assigned_to"):
        raise HTTPException(400, "Task has no assigned employee")

    update_task(task_id, {"status": "in_progress"})

    t = threading.Thread(target=_run_delegated_task, args=(task,), daemon=True)
    t.start()
    return {"delegated": True, "task_id": task_id}


@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str):
    from task_store import get_task, update_task
    task = get_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    _complete_task(task, response="")
    return {"completed": True, "task_id": task_id}


def _run_delegated_task(task: dict):
    from task_store import get_task_attachments, update_task
    from slack_router import call_employee
    task_id = task["id"]
    employee_id = task["assigned_to"]

    attachments = get_task_attachments(task_id)

    parts = [
        f"[task_id={task_id}]",
        f"You have been delegated a task: **{task['title']}**",
        task.get("description") or "",
    ]
    for att in attachments:
        parts.append(f"\n--- Attachment: {att['filename']} ---\n{att['text_content']}")
    parts.append(
        "\nComplete this task according to your system rules:\n"
        "- If this task asks you to CREATE, SCHEDULE, or BREAK DOWN work into items "
        "(e.g. populate a backlog, turn a plan into tasks, set up recurring tasks), "
        "call `create_task` once per item. Do NOT write content, do NOT call `communicate` or `send_message`. "
        "Use `list_artefacts` / `read_artefact` first if you need a plan or calendar you previously produced. "
        "When all tasks are created, respond with a plain summary of what you created.\n"
        "- If this task asks you to PRODUCE, WRITE, or DRAFT actual content (a blog post, "
        "report, LinkedIn post, etc.), do the work and call `store_result` at the end."
    )

    # Inject template schema into agent prompt if task has a template_id
    template_id = task.get("template_id")
    if template_id:
        from publishers.publish_store import get_template
        tmpl = get_template(template_id)
        if tmpl:
            import json as _json
            parts.append(
                f"\n**Document Template:** Use the following JSON Schema as the structure for your output document.\n"
                f"Template: {tmpl['name']}\n"
                f"Schema: {_json.dumps(tmpl['json_schema'], indent=2)}\n"
                f"When calling store_result, pass template_id='{template_id}' and a metadata JSON string matching the schema fields."
            )

    message = "\n".join(filter(None, parts))

    try:
        response = call_employee(employee_id, message)
        _complete_task(task, response)
    except Exception as e:
        logger.error("Delegation failed for task %s: %s", task_id, e)
        update_task(task_id, {"status": "backlog"})


def _complete_task(task: dict, response: str):
    from task_store import update_task, get_latest_artefact_for_task
    from slack_router import _slack_web_client
    task_id = task["id"]
    employee_id = task.get("assigned_to", "")
    update_task(task_id, {"status": "awaiting_approval"})

    slack_channel = task.get("slack_channel")
    slack_ts = task.get("slack_ts")
    web = _slack_web_client()
    if not (slack_channel and web):
        return

    try:
        # Check if the agent stored a new artefact for this specific task
        artefact = get_latest_artefact_for_task(task_id, employee_id)

        # Only include artefact content if it was explicitly linked to this task_id
        # (avoids re-posting stale artefacts from previous runs)
        artefact_linked = artefact and artefact.get("task_id") == task_id

        if artefact_linked:
            # Link artefact to task so approve_task_and_publish can dispatch Word publishing
            update_task(task_id, {"artefact_id": artefact["id"]})
            artefact_title = artefact.get("title", "")
            content = artefact.get("content", "")
            # Slack's chat.postMessage has a ~40,000 char limit; large artefacts
            # (e.g. full tender documents) would cause a silent msg_too_long failure.
            # Post a preview and let the user view the full artefact in the task manager.
            MAX_PREVIEW = 2000
            if len(content) > MAX_PREVIEW:
                preview = content[:MAX_PREVIEW].rsplit("\n", 1)[0]
                content = preview + f"\n\n_(preview truncated — full document in task manager)_"
            body = f"*{artefact_title}*\n\n{content}" if artefact_title else content
            web.chat_postMessage(
                channel=slack_channel,
                thread_ts=slack_ts,
                text=f":white_check_mark: *{task['title']}* — completed, awaiting approval\n\n{body}",
            )
        else:
            # No linked artefact — post the agent's response text
            output = response.strip() or "_(task completed)_"
            MAX_PREVIEW = 2000
            if len(output) > MAX_PREVIEW:
                output = output[:MAX_PREVIEW].rsplit("\n", 1)[0] + "\n\n_(preview truncated — full output in task manager)_"
            web.chat_postMessage(
                channel=slack_channel,
                thread_ts=slack_ts,
                text=f":white_check_mark: *{task['title']}* — completed, awaiting approval\n\n{output}",
            )
    except Exception as e:
        logger.warning("Slack reply failed for task %s: %s", task_id, e)


# ── Task attachments ──────────────────────────────────────────────────────────

@app.get("/tasks/{task_id}/attachments")
def list_attachments(task_id: str):
    from task_store import get_task_attachments
    return get_task_attachments(task_id)


@app.post("/tasks/{task_id}/attachments")
async def upload_attachment(task_id: str, file: UploadFile = File(...)):
    from task_store import add_attachment
    content = await file.read()
    filename = file.filename or "attachment"
    mime = file.content_type or ""

    if "pdf" in mime or filename.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(422, f"PDF extraction failed: {e}")
        content_type = "application/pdf"
    elif mime.startswith("text/") or filename.lower().endswith((".txt", ".md")):
        text = content.decode("utf-8", errors="replace")
        content_type = "text/plain"
    else:
        raise HTTPException(415, "Unsupported file type. Upload PDF or plain text files.")

    att = add_attachment(task_id, filename, text, content_type)
    return att


@app.delete("/tasks/{task_id}/attachments/{attachment_id}")
def remove_attachment(task_id: str, attachment_id: str):
    from task_store import delete_attachment
    ok = delete_attachment(attachment_id)
    if not ok:
        raise HTTPException(500, "Failed to delete attachment")
    return {"deleted": True}


# ── Publish channels ──────────────────────────────────────────────────────────

@app.get("/publish/channels")
def list_publish_channels():
    from publishers.publish_store import get_channels
    return get_channels()


@app.post("/publish/channels")
def create_publish_channel(req: PublishChannelRequest):
    from publishers.publish_store import create_channel
    result = create_channel({"name": req.name, "type": req.type, "config": req.config, "available_to": req.available_to})
    if not result:
        raise HTTPException(500, "Failed to create channel")
    return result


@app.patch("/publish/channels/{channel_id}")
def update_publish_channel(channel_id: str, req: PublishChannelRequest):
    from publishers.publish_store import update_channel
    updates = {}
    if req.name: updates["name"] = req.name
    if req.type: updates["type"] = req.type
    if req.config: updates["config"] = req.config
    if req.available_to is not None: updates["available_to"] = req.available_to
    result = update_channel(channel_id, updates)
    if not result:
        raise HTTPException(500, "Failed to update channel")
    return result


@app.delete("/publish/channels/{channel_id}")
def delete_publish_channel(channel_id: str):
    from publishers.publish_store import delete_channel
    ok = delete_channel(channel_id)
    if not ok:
        raise HTTPException(500, "Failed to delete channel")
    return {"deleted": True}


# ── Publish rules ─────────────────────────────────────────────────────────────

@app.get("/publish/rules")
def list_publish_rules(employee_id: str = ""):
    from publishers.publish_store import get_rules
    return get_rules(employee_id)


@app.post("/publish/rules")
def create_publish_rule(req: PublishRuleRequest):
    from publishers.publish_store import create_rule
    result = create_rule({"employee_id": req.employee_id, "channel_id": req.channel_id, "trigger": req.trigger})
    if not result:
        raise HTTPException(500, "Failed to create rule")
    return result


@app.delete("/publish/rules/{rule_id}")
def delete_publish_rule(rule_id: str):
    from publishers.publish_store import delete_rule
    ok = delete_rule(rule_id)
    if not ok:
        raise HTTPException(500, "Failed to delete rule")
    return {"deleted": True}


# ── Publish dispatch ──────────────────────────────────────────────────────────

@app.post("/publish")
def trigger_publish(req: PublishRequest):
    from publishers.dispatcher import dispatch_publish
    try:
        return dispatch_publish(req.artefact_id, req.channel_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/publish/logs")
def get_publish_logs(artefact_id: str = ""):
    from publishers.publish_store import get_logs
    return get_logs(artefact_id)


# ── Task approval with auto-publish ───────────────────────────────────────────

@app.post("/tasks/{task_id}/approve")
def approve_task_and_publish(task_id: str):
    """
    Mark task as done and trigger auto-publish for any 'approved' rules
    matching the task's employee.
    """
    from task_store import get_task, update_task
    from publishers.publish_store import get_rules
    from publishers.dispatcher import dispatch_publish

    task = get_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    update_task(task_id, {"status": "done"})

    artefact_id = task.get("artefact_id")
    employee_id = task.get("assigned_to", "")

    if artefact_id and employee_id:
        rules = get_rules(employee_id)
        for rule in rules:
            if rule.get("trigger") == "approved":
                try:
                    dispatch_publish(artefact_id, rule["channel_id"])
                except Exception as e:
                    logger.warning("Auto-publish failed for rule %s: %s", rule["id"], e)

    return {"approved": True, "task_id": task_id}


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
