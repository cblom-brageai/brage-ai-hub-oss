# MCP Server Creation

Design and implement Model Context Protocol (MCP) servers using FastMCP (Python) that extend the capabilities of virtual employees.

## Outputs
- `server.py` — FastMCP application with tool definitions
- `requirements.txt` — pinned dependencies
- `Dockerfile` — container image for the MCP server
- `docker-compose` snippet — how to wire it into the stack
- `agent.config.md` entry — the URL line to add to the target employee's config

## Design steps
1. **Define the domain**: what data source or action does this server wrap?
2. **List tools**: each tool = one atomic operation (e.g. `get_invoice`, `list_projects`). Tools are read-only by default unless the use case requires writes.
3. **Define input/output schema**: typed Pydantic models for every tool. No untyped dicts.
4. **Auth strategy**: API key via env var, never hardcoded.
5. **Dry-run test**: before finalising, call the upstream API with a lightweight status/health request to confirm auth works.

## FastMCP skeleton
```python
from fastmcp import FastMCP
import os

mcp = FastMCP("service-name")

@mcp.tool()
def tool_name(param: str) -> dict:
    """One-line description for the LLM."""
    ...

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8080)
```

## Guidelines
- One file per MCP server unless complexity demands splitting
- Use `httpx` for upstream HTTP calls (async-friendly)
- Return structured dicts, not raw strings — the LLM parses them
- Log every upstream call at DEBUG level with request URL (no credentials)
- Always call `store_result` with the completed implementation as the final step
