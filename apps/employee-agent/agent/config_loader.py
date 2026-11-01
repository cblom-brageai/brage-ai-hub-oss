"""
Loads and caches employee configuration files.
- Strategy.md and Personality.md are single files
- skills/ directory contains multiple skill files (5-10 per employee)
  loaded natively by the Deep Agents SDK via the skills= parameter
- agent.config.md is the machine-readable config file (MCP servers, LLM overrides, human gate)
Handles SIGHUP for live reload without container restart.
"""
import os
import signal
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_DIR = Path(os.getenv("CONFIG_DIR", "/app/config"))

_cache: dict = {}


def _reload_handler(signum, frame):
    _cache.clear()
    print("Config reloaded (SIGHUP received)")


signal.signal(signal.SIGHUP, _reload_handler)


@dataclass
class EmployeeConfig:
    employee_name: str
    employee_id: str
    strategy_md: str
    personality_md: str
    skill_paths: list        # POSIX paths relative to CONFIG_DIR, passed to Deep Agents skills=
    mcp_servers: dict = field(default_factory=dict)
    llm_overrides: dict = field(default_factory=dict)
    human_gate_actions: list = field(default_factory=list)


def _read(filename: str) -> str:
    path = CONFIG_DIR / filename
    if not path.exists():
        return ""
    return path.read_text()


def _load_skill_paths() -> list[str]:
    """Return POSIX skill file paths relative to CONFIG_DIR for Deep Agents skills= parameter."""
    skills_dir = CONFIG_DIR / "skills"
    if not skills_dir.exists():
        return []
    return sorted(
        f"skills/{f.name}"
        for f in skills_dir.iterdir()
        if f.is_file() and f.suffix == ".md"
    )


def _parse_section(text: str, section: str) -> dict:
    """Parse a named INI-style [section] from markdown text."""
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


def _parse_human_gate(text: str) -> list:
    """Parse require_approval_for from [human_gate] section."""
    section = _parse_section(text, "human_gate")
    raw = section.get("require_approval_for", "")
    return [a.strip() for a in raw.split(",") if a.strip()]


def _aggregate_skill_configs() -> tuple[dict, dict, list]:
    """
    Read all skill files and aggregate [mcp_servers], [llm_overrides], [human_gate].
    Later files override earlier ones for duplicate keys.
    Also reads agent.config.md if present (machine-readable config file).
    """
    mcp_servers: dict = {}
    llm_overrides: dict = {}
    human_gate_actions: list = []

    # First read agent.config.md if it exists (central config overrides)
    config_text = _read("agent.config.md")

    # Then read individual skill files
    skills_dir = CONFIG_DIR / "skills"
    skill_texts = []
    if skills_dir.exists():
        for f in sorted(skills_dir.iterdir()):
            if f.is_file() and f.suffix == ".md":
                skill_texts.append(f.read_text())

    for text in skill_texts + [config_text]:
        mcp_servers.update(_parse_section(text, "mcp_servers"))
        llm_overrides.update(_parse_section(text, "llm_overrides"))
        human_gate_actions.extend(_parse_human_gate(text))

    return mcp_servers, llm_overrides, list(set(human_gate_actions))


def load_config() -> EmployeeConfig:
    if "config" in _cache:
        return _cache["config"]

    employee_id = os.getenv("EMPLOYEE_ID", "employee")
    strategy_md = _read("Strategy.md")
    personality_md = _read("Personality.md")
    skill_paths = _load_skill_paths()
    mcp_servers, llm_overrides, human_gate_actions = _aggregate_skill_configs()

    config = EmployeeConfig(
        employee_name=employee_id.replace("-", " ").title(),
        employee_id=employee_id,
        strategy_md=strategy_md,
        personality_md=personality_md,
        skill_paths=skill_paths,
        mcp_servers=mcp_servers,
        llm_overrides=llm_overrides,
        human_gate_actions=human_gate_actions,
    )
    _cache["config"] = config
    return config
