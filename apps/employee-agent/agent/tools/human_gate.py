from langchain_core.tools import tool
from langgraph.types import interrupt
import os


@tool
async def request_human_approval(draft_output: str, reason: str) -> str:
    """
    Pause execution and request human approval before proceeding.
    Use before sending any external communication that requires sign-off.
    Returns the human's response or 'Approved.' if no feedback.
    """
    response = interrupt({
        "draft_output": draft_output,
        "reason": reason,
        "employee_id": os.getenv("EMPLOYEE_ID"),
    })
    return response.get("feedback", "Approved.")
