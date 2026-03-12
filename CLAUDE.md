# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Turborepo monorepo with three services:

- `apps/employee-agent` — Python. Virtual employee runtime using Deep Agents SDK on LangGraph. Exposes a FastAPI/MCP server. Config-driven via mounted `.md` files.
- `apps/config-api` — Python FastAPI. Serves/saves employee config files (`Strategy.md`, `Skills.md`, `Personality.md`). Sends SIGHUP to employee containers for live reload.
- `apps/frontend` — Next.js 14 (App Router). Chat UI + config editor. Dark teal theme, dark/light toggle.

## Key commands

```bash
# Frontend dev
cd apps/frontend && pnpm install && pnpm dev

# Python dev (employee-agent)
cd apps/employee-agent && pip install -r requirements.txt
uvicorn mcp_server.server:app --reload --port 8000

# Python dev (config-api)
cd apps/config-api && pip install -r requirements.txt
uvicorn main:app --reload --port 8090

# Docker local (standard)
cd docker && docker compose -f docker-compose.local.yml up

# Docker local (privacy mode — Ollama)
cd docker && PRIVACY_MODE=true docker compose -f docker-compose.local.yml --profile privacy up

# Run tests
cd apps/employee-agent && pytest tests/ -v
cd apps/config-api && pytest tests/ -v

# Turborepo (frontend)
pnpm turbo build
pnpm turbo lint
```

## Environment

Copy `.env.example` to `.env` and fill in secrets. Never commit `.env`.

Key env vars:
- `PRIVACY_MODE=true` → routes all LLM calls to local Ollama (local mode only)
- `FS_BACKEND=disk|langgraph_store|memory` → Deep Agents virtual filesystem backend
- `EMPLOYEE_ID` → identifies which employee container is running (e.g. `marketing-manager`)
- `GOOGLE_API_KEY` → required. All employees use Google Gemini as the LLM provider.

## LLM convention

All employees **must** use Google Gemini via `GOOGLE_API_KEY`. Never configure `agent.config.md` with Anthropic or OpenAI models. Standard overrides:

```ini
[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview
```

## Agent architecture

`agent/graph.py` — entry point. `build_agent()` returns a Deep Agents `CompiledGraph`.
- All LLM calls go through `agent/llm_selector.py::get_llm()` — never instantiate models directly
- `Strategy.md` + `Personality.md` injected into system prompt; skills loaded natively via Deep Agents SDK `skills=` parameter from `skills/` directory
- `agent.config.md` holds machine-readable INI config: `[mcp_servers]`, `[llm_overrides]`, `[human_gate]` — never injected into prompt
- MCP tools auto-discovered at startup via `langchain-mcp-adapters` (non-fatal if server offline)
- Custom tools in `agent/tools/`: `human_gate`, `communicate`, `store_result`
- Agent built lazily on first request (~15s cold start); cached for subsequent calls
- Default LLM: `gemini-3-flash-preview`; reasoning override: `gemini-3.1-pro-preview`

## Config files (per employee)

Located at `docker/employees/<employee-id>/config/` (bind-mounted to `/app/config` in container):
- `Strategy.md` — goals, deliverables, decision authority (6+ month horizon)
- `Personality.md` — system prompt personality section
- `agent.config.md` — `[mcp_servers]`, `[llm_overrides]`, `[human_gate]` config
- `skills/` — one `.md` file per skill (5–10 per employee), pure capability descriptions

## Slack routing

Single Slack bot routes to employees by channel name. Configured in `apps/config-api/slack_router.py`.
- Socket Mode (no public URL needed) — uses `SLACK_APP_TOKEN` (`xapp-...`)
- Channel → employee mapping via `SLACK_CHANNEL_ROUTING` env var (JSON) on config-api
- `#marketing` → `marketing-manager` is set in `docker-compose.local.yml`
- Bot must be invited to each channel: `/invite @BotName`
- Required Slack event subscriptions: `message.channels`, `message.im`
- File uploads are handled in `handle_message` — PDFs are downloaded and text-extracted via `pypdf`; plain text files are inlined; other types are referenced by name

## Supabase

- `artefacts` table: stores all agent-produced documents (blog posts, reports, etc.)
- Migration: `supabase/migrations/001_artefacts.sql`
- `store_result` tool writes to Supabase — agent instructed via `<rules>` in system prompt NOT to use `write_file` for deliverables

## Open issues — Employee 1 (Marketing Manager)

- **Human approval gate not tested** — `[human_gate]` config exists in `agent.config.md` but `request_human_approval` tool has not been exercised. Should pause before `publish_external`, `send_email`, `campaign_launch`.
- **No artefacts viewer in frontend** — artefacts stored in Supabase but no UI to browse/read them. To be built as part of the AI Hub frontend.
- **Agent pre-warming** — first request after container start takes ~15s. Consider pre-building agent on startup rather than lazily.
- **hybrid-router MCP server not built** — commented out in `agent.config.md`. Needed for RAG/CAG/SQL tools. Build as part of knowledge pipeline phase.
- **Slack reply formatting** — plain text only. Markdown (bold, bullets) not rendered in Slack; consider using Slack Block Kit for richer output.

## Deployment

- **Local**: `docker-compose.local.yml`. Add `--profile privacy` for Ollama.
- **Cloud Run**: GitHub Actions workflow in `.github/workflows/deploy-cloud-run.yml`. Requires GCP secrets: `GCP_PROJECT_ID`, `GCP_SA_KEY`. App secrets stored in Google Secret Manager.

## Tech stack

| Layer | Technology |
|---|---|
| Agent runtime | Deep Agents SDK (`deepagents`) on LangGraph ≥ 0.2 |
| LLM default | Gemini Flash (`gemini-3-flash-preview`) |
| LLM privacy | Ollama (local) |
| Embeddings | Google `text-embedding-004` |
| Vector DB | Supabase pgvector |
| Tracing | LangSmith EU (`eu.api.smith.langchain.com`) |
| MCP server | FastMCP (inbound) |
| MCP client | `langchain-mcp-adapters` (outbound) |
| Frontend | Next.js 14, Tailwind CSS, App Router |
| Storage | Supabase (PostgreSQL) |
| Meeting audio | Soniox (future) |
