"""
Inbound MCP server — exposes the employee agent to the platform and chat UI.
"""
import os
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Employee Agent MCP Server")
_agent = None


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


class ChatRequest(BaseModel):
    message: str


class TaskRequest(BaseModel):
    task: str
    context: dict = {}


@app.post("/chat/{employee_id}")
async def chat(employee_id: str, req: ChatRequest):
    import logging
    logger = logging.getLogger(__name__)
    try:
        agent = await get_agent()
        result = await agent.ainvoke({"messages": [{"role": "user", "content": req.message}]})
        last = result["messages"][-1]
        return {"response": extract_text(last.content) if hasattr(last, "content") else str(last)}
    except Exception as e:
        logger.exception("Agent error for %s", employee_id)
        return {"response": f"_(agent error: {e})_"}


@app.post("/task/{employee_id}")
async def execute_task(employee_id: str, req: TaskRequest):
    agent = await get_agent()
    result = await agent.ainvoke({"messages": [{"role": "user", "content": req.task}]})
    last = result["messages"][-1]
    return {"result": extract_text(last.content) if hasattr(last, "content") else str(last), "status": "completed"}


@app.get("/health")
async def health():
    return {"status": "ok", "employee_id": os.getenv("EMPLOYEE_ID")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
