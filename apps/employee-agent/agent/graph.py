"""
Virtual Employee agent using Deep Agents SDK.
create_deep_agent() provides planning, file I/O, sub-agents, and memory.
Custom tools layered on top: human_gate, communicate, store_result.
"""
import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from agent.config_loader import load_config
from agent.llm_selector import get_llm


async def build_agent():
    from deepagents import create_deep_agent

    config = load_config()

    system_prompt = f"""<identity>
You are {config.employee_name}, a virtual employee at Brage AI.
</identity>

<strategy>
{config.strategy_md}
</strategy>

<personality>
{config.personality_md}
</personality>
"""

    # Build MCP tools from Skills.md [mcp_servers]
    mcp_tools = []
    if config.mcp_servers:
        mcp_client = MultiServerMCPClient(
            {
                name: {"url": url, "transport": "streamable_http"}
                for name, url in config.mcp_servers.items()
            }
        )
        mcp_tools = await mcp_client.get_tools()

    # Brage-specific custom tools
    from agent.tools.human_gate import request_human_approval
    from agent.tools.communicate import send_message
    from agent.tools.store_result import store_result

    custom_tools = [request_human_approval, send_message, store_result]

    fs_backend = os.getenv("FS_BACKEND", "disk")
    fs_root = os.getenv("FS_ROOT", "/app/config/artefacts")

    agent = create_deep_agent(
        model=get_llm(config.llm_overrides.get("reason")),
        tools=mcp_tools + custom_tools,
        system_prompt=system_prompt,
        fs_backend=fs_backend,
        fs_root=fs_root,
    )

    return agent
