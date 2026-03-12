"""
create_task — lets a virtual employee add a task to the Brage AI Hub backlog.

Use this when asked to PLAN, SCHEDULE, or ORGANISE work into tasks — NOT when
asked to do the work itself.  Call once per task item.
"""
import os
import httpx
from langchain_core.tools import tool

CONFIG_API_URL = os.getenv("CONFIG_API_URL", "http://config-api:8090")


@tool
def create_task(
    title: str,
    description: str = "",
    assigned_to: str = "",
    recurrence: str = "",
    scheduled_at: str = "",
) -> str:
    """
    Create a task in the Brage AI Hub task management system (backlog).

    Use this tool when you are asked to:
    - Break a plan or calendar into tasks
    - Schedule recurring work items
    - Populate the backlog from a content plan, publishing calendar, or project plan
    - Create a to-do item for yourself or another employee

    Do NOT use this tool to do the work itself — only to register the task.
    Call this tool once per task item.

    Args:
        title: Short task title (max 80 chars).
        description: Fuller description of what needs to be done.
        assigned_to: Employee ID to assign the task to (e.g. 'marketing-manager').
                     Leave empty to create an unassigned backlog task.
        recurrence: Cron expression for recurring tasks (e.g. '0 9 * * 1' for
                    every Monday at 09:00). Leave empty for one-off tasks.
        scheduled_at: ISO 8601 datetime for a one-off scheduled task
                      (e.g. '2026-03-20T09:00:00+01:00'). Leave empty otherwise.

    Returns:
        Confirmation string with the task ID, or an error message.
    """
    try:
        resp = httpx.post(
            f"{CONFIG_API_URL}/tasks",
            json={
                "title": title,
                "description": description,
                "assigned_to": assigned_to,
                "recurrence": recurrence,
                "scheduled_at": scheduled_at,
                "created_by": "agent",
            },
            timeout=15,
        )
        resp.raise_for_status()
        task = resp.json()
        task_id = task.get("id", "unknown")
        assign_note = f", assigned to {assigned_to}" if assigned_to else ""
        recur_note = f", recurring: {recurrence}" if recurrence else ""
        return f"Task created: '{title}' (ID: {task_id}{assign_note}{recur_note})"
    except Exception as e:
        return f"Failed to create task '{title}': {e}"
