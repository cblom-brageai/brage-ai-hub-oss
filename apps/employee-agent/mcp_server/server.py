"""
Inbound MCP server — exposes the employee agent to the platform and chat UI.
"""
import os
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Employee Agent MCP Server")
_agent = None


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
    agent = await get_agent()
    result = await agent.ainvoke({"messages": [{"role": "user", "content": req.message}]})
    last = result["messages"][-1]
    return {"response": last.content if hasattr(last, "content") else str(last)}


@app.post("/task/{employee_id}")
async def execute_task(employee_id: str, req: TaskRequest):
    agent = await get_agent()
    result = await agent.ainvoke({"messages": [{"role": "user", "content": req.task}]})
    last = result["messages"][-1]
    return {"result": last.content if hasattr(last, "content") else str(last), "status": "completed"}


@app.get("/health")
async def health():
    return {"status": "ok", "employee_id": os.getenv("EMPLOYEE_ID")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
