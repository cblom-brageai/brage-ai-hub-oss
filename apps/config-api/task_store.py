"""
Task store — CRUD for the tasks table via Supabase REST API.
Used by the scheduler and Slack router (no SDK needed, plain httpx).
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

try:
    from croniter import croniter
    _HAS_CRONITER = True
except ImportError:
    _HAS_CRONITER = False

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
# Support SUPABASE_KEY (existing convention) and SUPABASE_SERVICE_KEY
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _next_run(recurrence: str) -> Optional[str]:
    if not _HAS_CRONITER or not recurrence:
        return None
    try:
        cron = croniter(recurrence, datetime.now(timezone.utc))
        return cron.get_next(datetime).isoformat()
    except Exception as e:
        logger.warning("Invalid cron expression '%s': %s", recurrence, e)
        return None


def create_task(
    title: str,
    description: str = "",
    assigned_to: str = "",
    created_by: str = "slack",
    slack_channel: str = "",
    slack_ts: str = "",
    recurrence: str = "",
    scheduled_at: str = "",
) -> dict:
    data: dict = {
        "title": title,
        "status": "backlog",
        "created_by": created_by,
    }
    if description:   data["description"]   = description
    if assigned_to:   data["assigned_to"]   = assigned_to
    if slack_channel: data["slack_channel"] = slack_channel
    if slack_ts:      data["slack_ts"]      = slack_ts
    if recurrence:
        data["recurrence"]  = recurrence
        data["next_run_at"] = _next_run(recurrence)
    elif scheduled_at:
        data["scheduled_at"] = scheduled_at
        data["next_run_at"]  = scheduled_at

    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tasks",
            headers=_headers(),
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()[0]
    except Exception as e:
        logger.error("Failed to create task: %s", e)
        return {}


def get_task(task_id: str) -> dict | None:
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tasks",
            headers=_headers(),
            params={"id": f"eq.{task_id}", "select": "*"},
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as e:
        logger.error("Failed to get task %s: %s", task_id, e)
        return None


def get_due_tasks() -> list[dict]:
    """Return tasks whose next_run_at is in the past and status is not done."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tasks",
            headers=_headers(),
            params={
                "next_run_at": f"lte.{now}",
                "status": "neq.done",
                "select": "*",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to fetch due tasks: %s", e)
        return []


def add_attachment(task_id: str, filename: str, text_content: str, content_type: str = "text/plain") -> dict:
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/task_attachments",
            headers=_headers(),
            json={"task_id": task_id, "filename": filename,
                  "text_content": text_content, "content_type": content_type},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()[0]
    except Exception as e:
        logger.error("Failed to add attachment to task %s: %s", task_id, e)
        return {}


def get_task_attachments(task_id: str) -> list[dict]:
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/task_attachments",
            headers=_headers(),
            params={"task_id": f"eq.{task_id}", "select": "*", "order": "created_at.asc"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to get attachments for task %s: %s", task_id, e)
        return []


def delete_attachment(attachment_id: str) -> bool:
    try:
        resp = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/task_attachments",
            headers=_headers(),
            params={"id": f"eq.{attachment_id}"},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Failed to delete attachment %s: %s", attachment_id, e)
        return False


def get_latest_artefact_for_task(task_id: str, employee_id: str) -> dict | None:
    """Return the most recent artefact linked to task_id, or the employee's most recent artefact."""
    try:
        # First try exact task_id match
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/artefacts",
            headers=_headers(),
            params={"task_id": f"eq.{task_id}", "select": "*", "order": "created_at.desc", "limit": "1"},
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        if rows:
            return rows[0]
        # Fall back to most recent artefact by employee in the last hour
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/artefacts",
            headers=_headers(),
            params={
                "employee_id": f"eq.{employee_id}",
                "created_at": f"gte.{cutoff}",
                "select": "*",
                "order": "created_at.desc",
                "limit": "1",
            },
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as e:
        logger.error("Failed to fetch artefact for task %s: %s", task_id, e)
        return None


def update_task(task_id: str, updates: dict) -> dict:
    try:
        resp = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/tasks",
            headers=_headers(),
            params={"id": f"eq.{task_id}"},
            json=updates,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to update task %s: %s", task_id, e)
        return {}
