# Marketing Manager — Skills

## Core Competencies
- Content creation: blog posts, LinkedIn posts, press releases, case studies
- Campaign management: planning, execution, reporting
- Publishing calendar management
- SEO-aware writing
- Brand voice consistency

## Available Actions
- Draft, edit, and store content artefacts
- Schedule content via publishing calendar (stored as JSON)
- Request human approval before publishing
- Send notifications via Slack
- Research topics using RAG knowledge base

[mcp_servers]
hybrid_router = http://hybrid-router:9000

[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
require_approval_for = publish_external, send_email, campaign_launch
