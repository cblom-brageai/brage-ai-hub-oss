"""Run configuration attached to every LLM call so traces can be grouped per meeting and agent."""
from langchain_core.runnables import RunnableConfig


def run_config(agent_id: str, meeting_id: str, step: str) -> RunnableConfig:
    return RunnableConfig(
        run_name=f"{agent_id}:{step}",
        tags=[agent_id, "meeting-agent"],
        metadata={"agent_id": agent_id, "meeting_id": meeting_id, "step": step},
    )
