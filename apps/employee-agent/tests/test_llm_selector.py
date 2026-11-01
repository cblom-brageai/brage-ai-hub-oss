import pytest


def test_privacy_mode_routes_to_ollama(monkeypatch):
    monkeypatch.setenv("PRIVACY_MODE", "true")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:7b")
    from agent.llm_selector import get_llm

    llm = get_llm("gemini-3-flash-preview")
    assert type(llm).__name__ == "ChatOllama"
    assert llm.model == "qwen2.5:7b"


def test_env_defaults_and_override(monkeypatch):
    monkeypatch.delenv("PRIVACY_MODE", raising=False)
    monkeypatch.setenv("DEFAULT_LLM", "ollama/llama3.1:8b")
    monkeypatch.setenv("REASONING_LLM", "ollama/deepseek-r1:14b")
    from agent.llm_selector import get_llm, resolve_model

    assert resolve_model("write") == "ollama/llama3.1:8b"
    assert resolve_model("reason") == "ollama/deepseek-r1:14b"
    assert resolve_model("reason", override="ollama/x") == "ollama/x"
    assert get_llm(role="reason").model == "deepseek-r1:14b"


def test_unknown_model_rejected(monkeypatch):
    monkeypatch.delenv("PRIVACY_MODE", raising=False)
    from agent.llm_selector import get_llm

    with pytest.raises(ValueError):
        get_llm("mistral-large")
