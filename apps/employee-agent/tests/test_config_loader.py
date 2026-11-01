from agent import config_loader


def test_parse_section_reads_ini_blocks():
    text = """
Some skills text

[mcp_servers]
hybrid_router = http://hybrid-router:9000
rag = http://rag-server:9001

[llm_overrides]
reason = claude-sonnet-4-6
"""
    servers = config_loader._parse_section(text, "mcp_servers")
    assert servers == {"hybrid_router": "http://hybrid-router:9000", "rag": "http://rag-server:9001"}
    assert config_loader._parse_section(text, "llm_overrides") == {"reason": "claude-sonnet-4-6"}
    assert config_loader._parse_section(text, "missing") == {}


def test_parse_human_gate():
    actions = config_loader._parse_human_gate("[human_gate]\nrequire_approval_for = publish_external, send_email\n")
    assert "publish_external" in actions
    assert "send_email" in actions


def test_load_config_from_directory(tmp_path, monkeypatch):
    (tmp_path / "Strategy.md").write_text("# Strategy\nGoals here")
    (tmp_path / "Personality.md").write_text("# Personality\nFriendly")
    (tmp_path / "agent.config.md").write_text(
        "[mcp_servers]\ngithub = http://github-mcp:8082/mcp\n\n[llm_overrides]\nreason = gemini-3.1-pro-preview\n"
    )
    (tmp_path / "skills").mkdir()
    (tmp_path / "skills" / "writing.md").write_text("# Writing")
    monkeypatch.setattr(config_loader, "CONFIG_DIR", tmp_path)
    monkeypatch.setenv("EMPLOYEE_ID", "test-employee")
    config_loader._cache.clear()

    cfg = config_loader.load_config()
    assert cfg.strategy_md.startswith("# Strategy")
    assert cfg.personality_md.startswith("# Personality")
    assert cfg.skill_paths == ["skills/writing.md"]
    assert cfg.mcp_servers == {"github": "http://github-mcp:8082/mcp"}
    assert cfg.llm_overrides["reason"] == "gemini-3.1-pro-preview"
    config_loader._cache.clear()
