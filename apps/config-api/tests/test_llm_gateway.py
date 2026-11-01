"""The /llm/generate gateway, exercised with a fake chat model (no provider credentials)."""
import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CONFIG_ROOT", str(tmp_path))
    monkeypatch.setenv("GIT_ENABLED", "false")
    from main import app

    return TestClient(app)


def _fake(responses):
    import llm_selector

    def fake_get_llm(override=None, role="write", **kwargs):
        return FakeListChatModel(responses=list(responses))

    return llm_selector, fake_get_llm


def test_generate_text(client, monkeypatch):
    mod, fake = _fake(["Hello from the model"])
    monkeypatch.setattr(mod, "get_llm", fake)
    res = client.post("/llm/generate", json={"prompt": "hi", "system": "be brief"})
    assert res.status_code == 200
    assert res.json() == {"text": "Hello from the model"}


def test_generate_json_strips_code_fences(client, monkeypatch):
    mod, fake = _fake(['```json\n{"is_task": true, "title": "Write post"}\n```'])
    monkeypatch.setattr(mod, "get_llm", fake)
    res = client.post("/llm/generate", json={"prompt": "classify", "json_mode": True})
    assert res.status_code == 200
    assert res.json()["json"] == {"is_task": True, "title": "Write post"}


def test_generate_json_rejects_invalid(client, monkeypatch):
    mod, fake = _fake(["not json at all"])
    monkeypatch.setattr(mod, "get_llm", fake)
    res = client.post("/llm/generate", json={"prompt": "x", "json_mode": True})
    assert res.status_code == 502


def test_generate_requires_input(client):
    res = client.post("/llm/generate", json={})
    assert res.status_code == 400


def test_slack_intent_uses_gateway_selector(monkeypatch):
    mod, fake = _fake(['{"is_task": true, "title": "Draft newsletter", "description": "", "recurrence": "", "scheduled_at": ""}'])
    monkeypatch.setattr(mod, "get_llm", fake)
    import slack_router

    result = slack_router._classify_task_intent("Please draft the newsletter by Friday")
    assert result["is_task"] is True and result["title"] == "Draft newsletter"
