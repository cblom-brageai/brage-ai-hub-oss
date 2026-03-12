"""
Virtual Employee agent using Deep Agents SDK.
create_deep_agent() provides planning, file I/O, sub-agents, and memory.
Skills are loaded natively by the SDK from config/skills/*.md
Custom tools layered on top: human_gate, communicate, store_result.
"""
import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from agent.config_loader import load_config
from agent.llm_selector import get_llm
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend


async def build_agent():
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

<rules>
ALWAYS call the `store_result` tool as the final step when you complete any written deliverable (blog post, LinkedIn post, report, brief, etc.). Do NOT use `write_file` to save deliverables — use `store_result` so they are persisted to the company database. Pass the source channel (e.g. 'slack' or 'chat') in the source parameter.
To review, continue, or reference your previous work, use `list_artefacts` to see what you have produced and `read_artefact` to retrieve the full content of any document by filename or id.
</rules>
"""

    # Build MCP tools from [mcp_servers] — skip servers that are unreachable
    mcp_tools = []
    if config.mcp_servers:
        try:
            mcp_client = MultiServerMCPClient(
                {
                    name: {"url": url, "transport": "streamable_http"}
                    for name, url in config.mcp_servers.items()
                }
            )
            mcp_tools = await mcp_client.get_tools()
        except Exception as e:
            print(f"Warning: MCP tool loading failed (some servers may be offline): {e}")

    # Brage-specific custom tools
    from agent.tools.human_gate import request_human_approval
    from agent.tools.communicate import send_message
    from agent.tools.store_result import store_result
    from agent.tools.read_artefacts import list_artefacts, read_artefact

    custom_tools = [request_human_approval, send_message, store_result, list_artefacts, read_artefact]

    # FilesystemBackend rooted at CONFIG_DIR so skill paths resolve correctly
    config_dir = os.getenv("CONFIG_DIR", "/app/config")
    backend = FilesystemBackend(root_dir=config_dir)

    agent = create_deep_agent(
        model=get_llm(config.llm_overrides.get("reason")),
        tools=mcp_tools + custom_tools,
        system_prompt=system_prompt,
        # Skills loaded natively by Deep Agents SDK from skills/*.md
        skills=config.skill_paths if config.skill_paths else None,
        backend=backend,
    )

    return agent
