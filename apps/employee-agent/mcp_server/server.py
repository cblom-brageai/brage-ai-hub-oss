"""
Inbound HTTP server — exposes the employee agent to the platform and chat UI.

Every conversation runs on a LangGraph thread (``thread_id``). Reusing a thread id keeps
the conversation history between calls; omitting it starts a fresh thread. When the agent
calls the human approval gate, the call returns ``pending_approval=True`` with the draft,
and ``POST /resume/{employee_id}`` continues the same thread with the reviewer's answer.
"""
import logging
import os
import uuid

import uvicorn
from fastapi import FastAPI
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import Command
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="Employee Agent")
_agent = None
EMPLOYEE_ID = os.getenv("EMPLOYEE_ID", "unknown")


def extract_text(content) -> str:
    """Extract plain text from LLM message content (handles str and content-block lists)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [b["text"] for b in content if isinstance(b, dict) and b.get("type") == "text"]
        return "\n".join(parts)
    return str(content)


async def get_agent():
    global _agent
    if _agent is None:
        from agent.graph import build_agent
        _agent = await build_agent()
    return _agent


def run_config(thread_id: str) -> RunnableConfig:
    """Thread + tracing metadata attached to every graph invocation."""
    return RunnableConfig(
        run_name=f"{EMPLOYEE_ID}-{thread_id[:8]}",
        tags=[EMPLOYEE_ID],
        metadata={"employee_id": EMPLOYEE_ID, "thread_id": thread_id},
        configurable={"thread_id": thread_id},
    )


def format_result(result: dict, thread_id: str) -> dict:
    """Turn a graph result into the API response, surfacing a pending approval gate."""
    interrupts = result.get("__interrupt__") or []
    if interrupts:
        payload = getattr(interrupts[0], "value", interrupts[0])
        payload = payload if isinstance(payload, dict) else {"reason": str(payload)}
        reason = payload.get("reason") or "Approval requested"
        draft = payload.get("draft_output") or ""
        return {
            "response": f"**Approval requested:** {reason}\n\n{draft}".strip(),
            "pending_approval": True,
            "interrupt": payload,
            "thread_id": thread_id,
        }
    messages = result.get("messages") or []
    last = messages[-1] if messages else None
    text = extract_text(last.content) if hasattr(last, "content") else (str(last) if last else "")
    return {"response": text, "pending_approval": False, "thread_id": thread_id}


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


class TaskRequest(BaseModel):
    task: str
    context: dict = {}
    thread_id: str | None = None


class ResumeRequest(BaseModel):
    thread_id: str
    approved: bool = True
    feedback: str = ""


@app.post("/chat/{employee_id}")
async def chat(employee_id: str, req: ChatRequest):
    thread_id = req.thread_id or uuid.uuid4().hex
    try:
        agent = await get_agent()
        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": req.message}]}, run_config(thread_id)
        )
        return format_result(result, thread_id)
    except Exception as e:
        logger.exception("Agent error for %s", employee_id)
        return {"response": f"_(agent error: {e})_", "pending_approval": False, "thread_id": thread_id}


@app.post("/task/{employee_id}")
async def execute_task(employee_id: str, req: TaskRequest):
    thread_id = req.thread_id or req.context.get("task_id") or uuid.uuid4().hex
    agent = await get_agent()
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": req.task}]}, run_config(thread_id)
    )
    out = format_result(result, thread_id)
    out["result"] = out["response"]
    out["status"] = "awaiting_approval" if out["pending_approval"] else "completed"
    return out


@app.post("/resume/{employee_id}")
async def resume(employee_id: str, req: ResumeRequest):
    """Answer a pending human-approval gate and continue the thread."""
    try:
        agent = await get_agent()
        result = await agent.ainvoke(
            Command(resume={"approved": req.approved, "feedback": req.feedback}),
            run_config(req.thread_id),
        )
        return format_result(result, req.thread_id)
    except Exception as e:
        logger.exception("Resume error for %s", employee_id)
        return {"response": f"_(agent error: {e})_", "pending_approval": False, "thread_id": req.thread_id}


@app.get("/health")
async def health():
    return {"status": "ok", "employee_id": os.getenv("EMPLOYEE_ID")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
