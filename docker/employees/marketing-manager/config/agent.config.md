# Agent Configuration — Marketing Manager

Machine-readable configuration. Not injected into the system prompt.

[mcp_servers]
hybrid_router = http://hybrid-router:9000

[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
require_approval_for = publish_external, send_email, campaign_launch
