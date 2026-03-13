"""
Slack Router — single bot, routes messages to the right virtual employee.

Routing priority:
1. Channel mapping (channel name/ID → employee_id)
2. Slash command (/mm, /pm, etc.)
3. Default employee (DEFAULT_EMPLOYEE env var)

Uses Socket Mode so no public endpoint is needed.
Started as a background thread from FastAPI lifespan.
"""
import os
import json
import threading
import logging
import httpx
from slack_sdk.web import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.response import SocketModeResponse
from slack_sdk.socket_mode.request import SocketModeRequest

logger = logging.getLogger(__name__)

# Module-level reference to the Slack WebClient so the scheduler can post replies
_web_client: "WebClient | None" = None


def _slack_web_client() -> "WebClient | None":
    return _web_client


# ── Configuration ─────────────────────────────────────────────────────────────

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN", "")   # xapp-... for Socket Mode
DEFAULT_EMPLOYEE = os.getenv("DEFAULT_EMPLOYEE", "marketing-manager")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Channels whose messages always become backlog tasks (no employee routing)
# Set via SLACK_BACKLOG_CHANNELS env var as JSON array: '["backlog", "tasks"]'
_backlog_env = os.getenv("SLACK_BACKLOG_CHANNELS", '["backlog"]')
BACKLOG_CHANNELS: list[str] = json.loads(_backlog_env)

# Channel name or ID → employee_id
# Override with SLACK_CHANNEL_ROUTING env var as JSON:
# '{"marketing": "marketing-manager", "projects": "project-manager"}'
_routing_env = os.getenv("SLACK_CHANNEL_ROUTING", "{}")
CHANNEL_ROUTING: dict[str, str] = json.loads(_routing_env)

# Slash command prefix → employee_id  (/mm → marketing-manager, /bm → bid-manager)
COMMAND_ROUTING: dict[str, str] = {
    "/mm": "marketing-manager",
    "/bm": "bid-manager",
}

# employee_id → internal URL of that employee's chat API
def _employee_url(employee_id: str) -> str:
    env_key = employee_id.upper().replace("-", "_") + "_URL"
    return os.getenv(env_key, f"http://employee-{employee_id}:8000")


# ── Core routing ──────────────────────────────────────────────────────────────

def resolve_employee(channel_name: str | None, command: str | None, channel_id: str | None = None) -> str:
    if command and command in COMMAND_ROUTING:
        return COMMAND_ROUTING[command]
    if channel_name and channel_name in CHANNEL_ROUTING:
        return CHANNEL_ROUTING[channel_name]
    # Fallback: route by raw channel ID (supports adding IDs to SLACK_CHANNEL_ROUTING)
    if channel_id and channel_id in CHANNEL_ROUTING:
        return CHANNEL_ROUTING[channel_id]
    return DEFAULT_EMPLOYEE


def call_employee(employee_id: str, message: str, timeout: int = 600) -> str:
    url = _employee_url(employee_id)
    try:
        resp = httpx.post(
            f"{url}/chat/{employee_id}",
            json={"message": message},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json().get("response", "_(no response)_")
    except httpx.TimeoutException:
        return "_(agent timed out — it may still be working)_"
    except Exception as e:
        logger.error("Employee call failed: %s", e)
        return f"_(error reaching {employee_id}: {e})_"


# ── Task intent detection ─────────────────────────────────────────────────────

_TASK_CLASSIFY_PROMPT = """You are a classifier. Given a Slack message, decide if it is a request
to create a task/work item for an AI employee, or a regular conversational message.

A task message typically:
- Asks someone to do something with a clear deliverable (write, create, prepare, check, analyse, send, schedule, remind)
- Describes a to-do item or work assignment
- May include a deadline or recurrence (every Monday, at 9am, weekly, etc.)

A conversational message:
- Is a question, greeting, quick follow-up, status check, or chitchat
- Does not describe a discrete piece of work to be completed

Reply with a JSON object only, no markdown:
{
  "is_task": true/false,
  "title": "<short task title, max 80 chars>",
  "description": "<fuller description extracted from the message, or empty string>",
  "recurrence": "<cron expression if recurring, e.g. '0 9 * * 1' for weekly Monday 9am, or empty string>",
  "scheduled_at": "<ISO 8601 datetime if one-off scheduled, or empty string>"
}"""


def _classify_task_intent(message: str) -> dict | None:
    """
    Use Gemini Flash to decide if a Slack message is a task creation request.
    Returns parsed JSON dict, or None on failure.
    """
    if not GOOGLE_API_KEY:
        return None
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-3-flash-preview")
        resp = model.generate_content(
            f"{_TASK_CLASSIFY_PROMPT}\n\nSlack message:\n{message}"
        )
        text = resp.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.warning("Task intent classification failed: %s", e)
        return None


# ── Slack event handlers ──────────────────────────────────────────────────────

def _get_channel_name(web: WebClient, channel_id: str) -> str:
    try:
        info = web.conversations_info(channel=channel_id)
        return info["channel"].get("name", channel_id)
    except Exception as e:
        logger.warning("Could not resolve channel name for %s: %s", channel_id, e)
        return channel_id


def _extract_file_content(web: WebClient, file_id: str) -> str | None:
    """Download a Slack file and return its text content."""
    import io
    try:
        file_info = web.files_info(file=file_id)
        f = file_info["file"]
        url = f.get("url_private_download") or f.get("url_private")
        name = f.get("name", "file")
        mimetype = f.get("mimetype", "")
        if not url:
            return f"[File attached: {name}]"
        resp = httpx.get(
            url,
            headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
            follow_redirects=True,
            timeout=30,
        )
        resp.raise_for_status()
        if "pdf" in mimetype:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(resp.content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            return f"[File: {name}]\n{text}"
        elif mimetype.startswith("text/"):
            return f"[File: {name}]\n{resp.text}"
        else:
            return f"[File attached: {name} ({mimetype})]"
    except Exception as e:
        logger.error("Failed to process Slack file %s: %s", file_id, e)
        return None


def _save_slack_file_attachments(web: WebClient, task_id: str, files: list):
    """Save Slack file content as task attachments (best-effort)."""
    if not task_id or not files:
        return
    from task_store import add_attachment
    for f in files:
        content = _extract_file_content(web, f["id"])
        if content:
            name = f.get("name", "attachment")
            mime = f.get("mimetype", "text/plain")
            add_attachment(task_id, name, content, mime)


def handle_message(web: WebClient, payload: dict):
    event = payload.get("event", {})
    logger.info("handle_message: type=%s subtype=%s channel=%s",
                event.get("type"), event.get("subtype"), event.get("channel"))

    # Ignore bot messages (including our own replies)
    # Allow "file_share" subtype through so uploaded files are processed
    subtype = event.get("subtype")
    if event.get("bot_id") or (subtype and subtype != "file_share"):
        return

    channel_id = event.get("channel", "")
    channel_type = event.get("channel_type", "")
    thread_ts = event.get("thread_ts") or event.get("ts")

    # Build message from text and any attached files
    parts = []
    text = (event.get("text") or "").strip()
    if text:
        parts.append(text)
    for f in event.get("files", []):
        content = _extract_file_content(web, f["id"])
        if content:
            parts.append(content)

    if not parts:
        return

    # Prepend thread context so the agent knows where to post replies
    context = f"[slack_thread channel_id={channel_id} thread_ts={thread_ts}]"
    message = context + "\n\n" + "\n\n".join(parts)

    # Resolve channel name for routing (DMs use channel_type=im)
    channel_name = "dm" if channel_type == "im" else _get_channel_name(web, channel_id)
    employee_id = resolve_employee(channel_name, None, channel_id=channel_id)

    # Separate text parts from file parts for attachment handling
    file_parts = event.get("files", [])
    raw_text = "\n\n".join(parts)

    # ── Task intent: backlog channels always create tasks ─────────────────────
    if channel_name in BACKLOG_CHANNELS:
        result = _classify_task_intent(raw_text)
        if result and result.get("is_task"):
            from task_store import create_task, add_attachment
            task = create_task(
                title=result.get("title") or parts[0][:80],
                description=result.get("description", ""),
                created_by="slack",
                slack_channel=channel_id,
                slack_ts=thread_ts,
                recurrence=result.get("recurrence", ""),
                scheduled_at=result.get("scheduled_at", ""),
            )
            task_id = task.get("id", "")
            _save_slack_file_attachments(web, task_id, file_parts)
            web.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_ts,
                text=f":white_check_mark: Task added to backlog: *{result.get('title')}*\nID: `{task_id}`",
            )
        else:
            web.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_ts,
                text="_(Could not classify as a task — please phrase it as a work request)_",
            )
        return

    # ── Employee channels: classify intent before routing ─────────────────────
    result = _classify_task_intent(raw_text)
    if result and result.get("is_task"):
        from task_store import create_task, add_attachment
        task = create_task(
            title=result.get("title") or raw_text[:80],
            description=result.get("description", ""),
            assigned_to=employee_id,
            created_by="slack",
            slack_channel=channel_id,
            slack_ts=thread_ts,
            recurrence=result.get("recurrence", ""),
            scheduled_at=result.get("scheduled_at", ""),
        )
        task_id = task.get("id", "")
        _save_slack_file_attachments(web, task_id, file_parts)
        recur_note = f" (recurring: `{result['recurrence']}`)" if result.get("recurrence") else ""
        web.chat_postMessage(
            channel=channel_id,
            thread_ts=thread_ts,
            text=(
                f":clipboard: Task created for *{employee_id}*{recur_note}: "
                f"*{result.get('title')}*\nAdded to backlog — ID: `{task_id}`"
            ),
        )
        return

    # ── Regular message: route to employee agent ──────────────────────────────
    try:
        web.reactions_add(channel=channel_id, name="hourglass_flowing_sand", timestamp=event["ts"])
    except Exception:
        pass

    response = call_employee(employee_id, message)

    # Remove thinking reaction and post reply in thread
    try:
        web.reactions_remove(channel=channel_id, name="hourglass_flowing_sand", timestamp=event["ts"])
    except Exception:
        pass

    web.chat_postMessage(
        channel=channel_id,
        thread_ts=thread_ts,
        text=response,
    )


def handle_slash_command(web: WebClient, payload: dict):
    command = payload.get("command", "")
    text = (payload.get("text") or "").strip()
    channel_id = payload.get("channel_id", "")
    response_url = payload.get("response_url")

    employee_id = resolve_employee(None, command)

    if not text:
        web.chat_postMessage(
            channel=channel_id,
            text=f"Usage: `{command} <your message>` — routes to *{employee_id}*",
        )
        return

    # Acknowledge immediately (Slack requires response within 3s)
    # Full response sent via response_url after processing
    import requests
    requests.post(response_url, json={"text": f"_Routing to {employee_id}…_"}, timeout=5)

    response = call_employee(employee_id, text)
    requests.post(response_url, json={"text": response, "replace_original": False}, timeout=10)


# ── Socket Mode client ────────────────────────────────────────────────────────

def _make_handler(web: WebClient):
    def handler(client: SocketModeClient, req: SocketModeRequest):
        # Acknowledge immediately
        client.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))

        try:
            if req.type == "events_api":
                handle_message(web, req.payload)
            elif req.type == "slash_commands":
                handle_slash_command(web, req.payload)
        except Exception:
            logger.exception("Unhandled error in Slack handler (type=%s)", req.type)

    return handler


def start_slack_router():
    """Start the Slack Socket Mode listener in a background daemon thread."""
    if not SLACK_BOT_TOKEN or not SLACK_APP_TOKEN:
        logger.warning("Slack tokens not set — Slack router disabled")
        return

    global _web_client
    web = WebClient(token=SLACK_BOT_TOKEN)
    _web_client = web
    socket_client = SocketModeClient(
        app_token=SLACK_APP_TOKEN,
        web_client=web,
    )
    socket_client.socket_mode_request_listeners.append(_make_handler(web))

    def _run():
        logger.info("Slack router started (Socket Mode)")
        socket_client.connect()
        # Keep thread alive
        threading.Event().wait()

    t = threading.Thread(target=_run, daemon=True, name="slack-router")
    t.start()
    logger.info("Slack router thread started")
