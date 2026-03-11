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

# ── Configuration ─────────────────────────────────────────────────────────────

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN", "")   # xapp-... for Socket Mode
DEFAULT_EMPLOYEE = os.getenv("DEFAULT_EMPLOYEE", "marketing-manager")

# Channel name or ID → employee_id
# Override with SLACK_CHANNEL_ROUTING env var as JSON:
# '{"marketing": "marketing-manager", "projects": "project-manager"}'
_routing_env = os.getenv("SLACK_CHANNEL_ROUTING", "{}")
CHANNEL_ROUTING: dict[str, str] = json.loads(_routing_env)

# Slash command prefix → employee_id  (/mm → marketing-manager)
COMMAND_ROUTING: dict[str, str] = {
    "/mm": "marketing-manager",
}

# employee_id → internal URL of that employee's chat API
def _employee_url(employee_id: str) -> str:
    env_key = employee_id.upper().replace("-", "_") + "_URL"
    return os.getenv(env_key, f"http://employee-{employee_id}:8000")


# ── Core routing ──────────────────────────────────────────────────────────────

def resolve_employee(channel_name: str | None, command: str | None) -> str:
    if command and command in COMMAND_ROUTING:
        return COMMAND_ROUTING[command]
    if channel_name and channel_name in CHANNEL_ROUTING:
        return CHANNEL_ROUTING[channel_name]
    return DEFAULT_EMPLOYEE


def call_employee(employee_id: str, message: str, timeout: int = 120) -> str:
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


# ── Slack event handlers ──────────────────────────────────────────────────────

def _get_channel_name(web: WebClient, channel_id: str) -> str:
    try:
        info = web.conversations_info(channel=channel_id)
        return info["channel"].get("name", channel_id)
    except Exception:
        return channel_id


def handle_message(web: WebClient, payload: dict):
    event = payload.get("event", {})

    # Ignore bot messages (including our own replies)
    if event.get("bot_id") or event.get("subtype"):
        return

    channel_id = event.get("channel", "")
    channel_type = event.get("channel_type", "")
    text = (event.get("text") or "").strip()
    thread_ts = event.get("thread_ts") or event.get("ts")

    if not text:
        return

    # Resolve channel name for routing (DMs use channel_type=im)
    channel_name = "dm" if channel_type == "im" else _get_channel_name(web, channel_id)
    employee_id = resolve_employee(channel_name, None)

    # Post a "thinking" reaction while processing
    try:
        web.reactions_add(channel=channel_id, name="hourglass_flowing_sand", timestamp=event["ts"])
    except Exception:
        pass

    response = call_employee(employee_id, text)

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

        if req.type == "events_api":
            handle_message(web, req.payload)

        elif req.type == "slash_commands":
            handle_slash_command(web, req.payload)

    return handler


def start_slack_router():
    """Start the Slack Socket Mode listener in a background daemon thread."""
    if not SLACK_BOT_TOKEN or not SLACK_APP_TOKEN:
        logger.warning("Slack tokens not set — Slack router disabled")
        return

    web = WebClient(token=SLACK_BOT_TOKEN)
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
