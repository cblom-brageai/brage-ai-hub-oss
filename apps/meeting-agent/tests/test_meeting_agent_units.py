import pytest


def test_run_config_carries_meeting_and_agent_ids():
    from agent.tracing import run_config

    cfg = run_config("qa-agent", "meeting-123", "answer")
    assert cfg["run_name"] == "qa-agent:answer"
    assert "qa-agent" in cfg["tags"] and "meeting-agent" in cfg["tags"]
    assert cfg["metadata"] == {"agent_id": "qa-agent", "meeting_id": "meeting-123", "step": "answer"}


def test_load_agent_config_parses_overrides_and_capabilities(tmp_path, monkeypatch):
    from agent import config_loader

    cfg_dir = tmp_path / "qa-agent" / "config"
    cfg_dir.mkdir(parents=True)
    (cfg_dir / "Personality.md").write_text("# QA\nBe helpful.")
    (cfg_dir / "agent.config.md").write_text(
        "[llm_overrides]\nreason = ollama/llama3.1:8b\nwrite = gemini-3-flash-preview\n\n"
        "[capabilities]\nanswer_questions = true\nlog_decisions = false\n"
    )
    monkeypatch.setattr(config_loader, "AGENT_CONFIGS_DIR", tmp_path)

    cfg = config_loader.load_agent_config("qa-agent")
    assert cfg.personality_md.startswith("# QA")
    assert cfg.llm_overrides["reason"] == "ollama/llama3.1:8b"
    assert cfg.capabilities == {"answer_questions": True, "log_decisions": False}


def test_privacy_mode_forces_local_model(monkeypatch):
    monkeypatch.setenv("PRIVACY_MODE", "true")
    from agent.llm_selector import get_llm

    assert type(get_llm("gemini-3.1-pro-preview", role="reason")).__name__ == "ChatOllama"


def test_unknown_model_rejected(monkeypatch):
    monkeypatch.delenv("PRIVACY_MODE", raising=False)
    from agent.llm_selector import get_llm

    with pytest.raises(ValueError):
        get_llm("llama-70b")
