import pytest
from pathlib import Path
import tempfile, os


def test_parse_mcp_servers():
    from agent.config_loader import _parse_mcp_servers
    skills = """
Some skills text

[mcp_servers]
hybrid_router = http://hybrid-router:9000
rag = http://rag-server:9001

[llm_overrides]
reason = claude-sonnet-4-6
"""
    servers = _parse_mcp_servers(skills)
    assert servers["hybrid_router"] == "http://hybrid-router:9000"
    assert servers["rag"] == "http://rag-server:9001"


def test_parse_llm_overrides():
    from agent.config_loader import _parse_llm_overrides
    skills = "[llm_overrides]\nreason = claude-sonnet-4-6\nwrite = gpt-4o\n"
    overrides = _parse_llm_overrides(skills)
    assert overrides["reason"] == "claude-sonnet-4-6"
    assert overrides["write"] == "gpt-4o"


def test_parse_human_gate():
    from agent.config_loader import _parse_human_gate
    skills = "[human_gate]\nrequire_approval_for = publish_external, send_email\n"
    actions = _parse_human_gate(skills)
    assert "publish_external" in actions
    assert "send_email" in actions
