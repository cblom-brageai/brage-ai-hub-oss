# Machine-readable configuration (never injected into the prompt)

[mcp_servers]
# name = http://host:port/mcp

[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
require_approval_for = publish_external, send_email
