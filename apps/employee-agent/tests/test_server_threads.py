"""
Exercise the chat / resume endpoints against a tiny LangGraph graph that uses interrupt(),
without any LLM. Verifies that thread ids keep history and that the human gate pauses and
resumes.
"""
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.types import interrupt


def _fake_graph():
    def agent(state: MessagesState):
        last = state["messages"][-1].content
        if "approve" in last.lower():
            answer = interrupt({"draft_output": "DRAFT", "reason": "external publish"})
            return {"messages": [AIMessage(content=f"human said: {answer}")]}
        return {"messages": [AIMessage(content=f"echo:{last} (history={len(state['messages'])})")]}

    g = StateGraph(MessagesState)
    g.add_node("agent", agent)
    g.add_edge(START, "agent")
    g.add_edge("agent", END)
    return g.compile(checkpointer=MemorySaver())


@pytest.fixture
def client():
    from mcp_server import server

    server._agent = _fake_graph()
    yield TestClient(server.app)
    server._agent = None


def test_thread_keeps_history(client):
    r1 = client.post("/chat/test", json={"message": "hello", "thread_id": "t1"}).json()
    assert r1["thread_id"] == "t1" and r1["pending_approval"] is False
    assert "history=1" in r1["response"]

    r2 = client.post("/chat/test", json={"message": "again", "thread_id": "t1"}).json()
    assert "history=3" in r2["response"], "second turn should see the earlier messages"

    r3 = client.post("/chat/test", json={"message": "fresh"}).json()
    assert r3["thread_id"] != "t1" and "history=1" in r3["response"]


def test_human_gate_pauses_and_resumes(client):
    r = client.post("/chat/test", json={"message": "please approve this", "thread_id": "gate"}).json()
    assert r["pending_approval"] is True
    assert r["interrupt"]["draft_output"] == "DRAFT"
    assert "external publish" in r["response"]

    done = client.post(
        "/resume/test", json={"thread_id": "gate", "approved": True, "feedback": "looks good"}
    ).json()
    assert done["pending_approval"] is False
    assert "looks good" in done["response"]


def test_task_endpoint_uses_task_id_as_thread(client):
    r = client.post("/task/test", json={"task": "do it", "context": {"task_id": "task-9"}}).json()
    assert r["thread_id"] == "task-9" and r["status"] == "completed"
