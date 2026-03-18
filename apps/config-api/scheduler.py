"""
Task scheduler — uses APScheduler to delegate scheduled/recurring tasks.
Checks every minute for tasks whose next_run_at is due.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from task_store import get_due_tasks, update_task, _next_run
from slack_router import call_employee, _slack_web_client

logger = logging.getLogger(__name__)


def _tick():
    """Check for tasks due to run and delegate them to their assigned employee."""
    tasks = get_due_tasks()
    for task in tasks:
        _run_task(task)


def _run_task(task: dict):
    task_id    = task.get("id", "")
    employee_id = task.get("assigned_to")
    title      = task.get("title", "Unnamed task")
    description = task.get("description", "")
    recurrence = task.get("recurrence")

    if not employee_id:
        logger.info("Task %s has no assigned employee — skipping", task_id)
        # Clear next_run_at so it doesn't loop forever
        update_task(task_id, {"next_run_at": None})
        return

    logger.info("Running scheduled task %s ('%s') for %s", task_id, title, employee_id)

    # Mark in_progress immediately to prevent double-execution
    update_task(task_id, {
        "status": "in_progress",
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "next_run_at": None,
    })

    message = "\n".join(filter(None, [
        f"[task_id={task_id}] [scheduled]",
        f"Scheduled task: **{title}**",
        description,
        "When complete, use the store_result tool to save your output.",
    ]))

    try:
        response = call_employee(employee_id, message)

        # Compute next run for recurring tasks; move one-off to awaiting_approval
        next_run = _next_run(recurrence) if recurrence else None
        update_task(task_id, {
            "status": "backlog" if recurrence else "awaiting_approval",
            "next_run_at": next_run,
        })

        # Reply in the originating Slack thread if available
        slack_channel = task.get("slack_channel")
        slack_ts      = task.get("slack_ts")
        web = _slack_web_client()
        if slack_channel and web:
            try:
                MAX_PREVIEW = 2000
                output = response.strip() or "_(task completed)_"
                if len(output) > MAX_PREVIEW:
                    output = output[:MAX_PREVIEW].rsplit("\n", 1)[0] + "\n\n_(preview truncated — full output in task manager)_"
                web.chat_postMessage(
                    channel=slack_channel,
                    thread_ts=slack_ts,
                    text=f"Task completed: *{title}*\n{output}",
                )
            except Exception as e:
                logger.warning("Could not post Slack reply for task %s: %s", task_id, e)

    except Exception as e:
        logger.error("Task %s failed: %s", task_id, e)
        update_task(task_id, {"status": "backlog"})


def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(_tick, "interval", minutes=1, id="task_tick", max_instances=1)
    scheduler.start()
    logger.info("Task scheduler started (1-minute tick)")
    return scheduler
