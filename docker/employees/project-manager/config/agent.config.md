# Agent Configuration — Project Manager

Machine-readable configuration. Not injected into the system prompt.

[mcp_servers]
# hybrid_router = http://hybrid-router:9000  # enable when hybrid-router service is running

[llm_overrides]
reason = gemini-3-flash-preview
write = gemini-3-flash-preview

[human_gate]
require_approval_for = approve_scope_change, rebaseline_budget, rebaseline_schedule, terminate_contractor, submit_exception_report
