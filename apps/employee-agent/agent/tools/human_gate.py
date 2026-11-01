from langchain_core.tools import tool
from langgraph.types import interrupt
import os


@tool
async def request_human_approval(draft_output: str, reason: str) -> str:
    """
    Pause execution and request human approval before proceeding.
    Use before sending any external communication that requires sign-off.
    Returns the human's response: 'Approved.' (optionally with feedback) or a
    rejection message that you must respect.
    """
    response = interrupt({
        "draft_output": draft_output,
        "reason": reason,
        "employee_id": os.getenv("EMPLOYEE_ID"),
    })
    if isinstance(response, dict):
        feedback = (response.get("feedback") or "").strip()
        if response.get("approved", True):
            return f"Approved. {feedback}".strip()
        return f"Rejected by the human reviewer. Feedback: {feedback or 'none given'}"
    return str(response) if response else "Approved."
