"""
Loads and caches employee configuration files.
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
    skills_md: str
    personality_md: str
    mcp_servers: dict = field(default_factory=dict)
    llm_overrides: dict = field(default_factory=dict)
    human_gate_actions: list = field(default_factory=list)


def _read(filename: str) -> str:
    path = CONFIG_DIR / filename
    if not path.exists():
        return ""
    return path.read_text()


def _parse_mcp_servers(skills_md: str) -> dict:
    """Parse [mcp_servers] section from Skills.md"""
    servers = {}
    in_section = False
    for line in skills_md.splitlines():
        if line.strip() == "[mcp_servers]":
            in_section = True
            continue
        if in_section and line.startswith("["):
            break
        if in_section and "=" in line:
            name, url = line.split("=", 1)
            servers[name.strip()] = url.strip()
    return servers


def _parse_llm_overrides(skills_md: str) -> dict:
    """Parse [llm_overrides] section from Skills.md"""
    overrides = {}
    in_section = False
    for line in skills_md.splitlines():
        if line.strip() == "[llm_overrides]":
            in_section = True
            continue
        if in_section and line.startswith("["):
            break
        if in_section and "=" in line:
            key, val = line.split("=", 1)
            overrides[key.strip()] = val.strip()
    return overrides


def _parse_human_gate(skills_md: str) -> list:
    """Parse [human_gate] require_approval_for from Skills.md"""
    actions = []
    in_section = False
    for line in skills_md.splitlines():
        if line.strip() == "[human_gate]":
            in_section = True
            continue
        if in_section and line.startswith("["):
            break
        if in_section and line.strip().startswith("require_approval_for"):
            parts = line.split("=", 1)
            if len(parts) == 2:
                actions = [a.strip() for a in parts[1].split(",")]
    return actions


def load_config() -> EmployeeConfig:
    if "config" in _cache:
        return _cache["config"]

    strategy_md = _read("Strategy.md")
    skills_md = _read("Skills.md")
    personality_md = _read("Personality.md")
    employee_id = os.getenv("EMPLOYEE_ID", "employee")

    config = EmployeeConfig(
        employee_name=employee_id.replace("-", " ").title(),
        employee_id=employee_id,
        strategy_md=strategy_md,
        skills_md=skills_md,
        personality_md=personality_md,
        mcp_servers=_parse_mcp_servers(skills_md),
        llm_overrides=_parse_llm_overrides(skills_md),
        human_gate_actions=_parse_human_gate(skills_md),
    )
    _cache["config"] = config
    return config
