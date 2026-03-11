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

## Agent architecture

`agent/graph.py` — entry point. `build_agent()` returns a Deep Agents `CompiledGraph`.
- All LLM calls go through `agent/llm_selector.py::get_llm()` — never instantiate models directly
- `Skills.md` is NOT injected into the system prompt — only `Strategy.md` + `Personality.md` are
- `Skills.md` is parsed for `[mcp_servers]`, `[llm_overrides]`, `[human_gate]` config sections
- MCP tools auto-discovered at startup via `langchain-mcp-adapters`
- Custom tools in `agent/tools/`: `human_gate`, `communicate`, `store_result`

## Config files (per employee)

Located at `docker/employees/<employee-id>/config/` (bind-mounted to `/app/config` in container):
- `Strategy.md` — goals, deliverables, decision authority (6+ month horizon)
- `Skills.md` — competencies + INI-style sections for MCP servers, LLM overrides, human gate
- `Personality.md` — system prompt personality section

## Deployment

- **Local**: `docker-compose.local.yml`. Add `--profile privacy` for Ollama.
- **Cloud Run**: GitHub Actions workflow in `.github/workflows/deploy-cloud-run.yml`. Requires GCP secrets: `GCP_PROJECT_ID`, `GCP_SA_KEY`. App secrets stored in Google Secret Manager.

## Tech stack

| Layer | Technology |
|---|---|
| Agent runtime | Deep Agents SDK (`deepagents`) on LangGraph ≥ 0.2 |
| LLM default | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| LLM privacy | Ollama (local) |
| Embeddings | Google `text-embedding-004` |
| Vector DB | Supabase pgvector |
| Tracing | LangSmith EU (`eu.api.smith.langchain.com`) |
| MCP server | FastMCP (inbound) |
| MCP client | `langchain-mcp-adapters` (outbound) |
| Frontend | Next.js 14, Tailwind CSS, App Router |
| Storage | Supabase (PostgreSQL) |
| Meeting audio | Soniox (future) |
