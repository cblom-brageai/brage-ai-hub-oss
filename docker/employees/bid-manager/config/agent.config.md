# Agent Configuration — Bid Manager

Machine-readable configuration. Not injected into the system prompt.

[mcp_servers]
# hybrid_router = http://hybrid-router:9000  # enable when hybrid-router service is running

[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
require_approval_for = submit_bid, include_pricing, nominate_subcontractor, commit_schedule
