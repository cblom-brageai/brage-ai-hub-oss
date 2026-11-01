# Agent Configuration — Developer

Machine-readable configuration. Not injected into the system prompt.

[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
approve_before = merge_to_main, deploy_to_field_device, add_production_secret, send_external_data

[mcp_servers]
github = http://github-mcp:8082
