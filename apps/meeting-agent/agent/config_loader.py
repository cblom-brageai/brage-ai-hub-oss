"""
Loads per-agent configuration from the mounted agent-configs directory.

Layout (bind-mounted from docker/meetings/agents/):
  /app/agent-configs/
    decision-logger/config/
      Personality.md
      agent.config.md
    qa-agent/config/
      Personality.md
      agent.config.md
    meetings-monitor/config/
      Personality.md
      agent.config.md
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

AGENT_CONFIGS_DIR = Path(os.getenv("AGENT_CONFIGS_DIR", "/app/agent-configs"))


@dataclass
class AgentConfig:
    agent_id: str
    personality_md: str
    llm_overrides: dict = field(default_factory=dict)
    capabilities: dict = field(default_factory=dict)


def _parse_section(text: str, section: str) -> dict:
    result = {}
    in_section = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == f"[{section}]":
            in_section = True
            continue
        if in_section and stripped.startswith("["):
            break
        if in_section and "=" in stripped:
            key, val = stripped.split("=", 1)
            result[key.strip()] = val.strip()
    return result


def load_agent_config(agent_id: str) -> AgentConfig:
    config_dir = AGENT_CONFIGS_DIR / agent_id / "config"

    personality_path = config_dir / "Personality.md"
    personality_md = personality_path.read_text() if personality_path.exists() else ""

    config_path = config_dir / "agent.config.md"
    config_text = config_path.read_text() if config_path.exists() else ""

    llm_overrides = _parse_section(config_text, "llm_overrides")
    capabilities_raw = _parse_section(config_text, "capabilities")

    # Parse boolean capability values
    capabilities = {
        k: v.lower() not in ("false", "0", "no")
        for k, v in capabilities_raw.items()
    }

    return AgentConfig(
        agent_id=agent_id,
        personality_md=personality_md,
        llm_overrides=llm_overrides,
        capabilities=capabilities,
    )
