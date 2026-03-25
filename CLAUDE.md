# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Prime directive

**After every code change, always restart the affected service(s) so the running software reflects the latest state.** Never leave a change undeployed. For Docker services, run `cd docker && make up` (main stack) or `make dev-up` (dev stack). For frontend-only changes, the dev server hot-reloads automatically. Confirm the service is back up before reporting done.

## Architecture

Turborepo monorepo with services:

- `apps/employee-agent` — Python. Virtual employee runtime using Deep Agents SDK on LangGraph. Exposes a FastAPI/MCP server. Config-driven via mounted `.md` files.
- `apps/config-api` — Python FastAPI. Serves/saves employee config files (`Strategy.md`, `Skills.md`, `Personality.md`). Sends SIGHUP to employee containers for live reload.
- `apps/frontend` — Next.js 14 (App Router). Chat UI + config editor. Dark teal theme, dark/light toggle.
- `apps/meeting-agent` — Python FastAPI. Orchestrates meeting agents (decision logger, Q&A, meetings monitor). Ingests Soniox transcription utterances and fans out to all active meeting agents.
- `apps/chrome-extension` — Manifest V3 Chrome extension. Side panel for browser-based meetings. Captures tab audio → streams to Soniox WebSocket → posts utterances to meeting-agent. Subscribes to Supabase Realtime for agent output.

## Branching

| Branch | Frontend port | Docker Compose | Purpose |
|--------|--------------|---------------|---------|
| `main` | 3000 | `docker-compose.local.yml` | Stable production-ready |
| `dev`  | 3001 | `docker-compose.dev.yml`  | Meeting app development |

Both stacks can run simultaneously. Main and dev use separate Docker networks (`bridge` default vs `brage-dev`).

## Key commands

```bash
# Frontend dev (dev branch — port 3001)
cd apps/frontend && pnpm install && pnpm dev

# Meeting agent dev
cd apps/meeting-agent && pip install -r requirements.txt
uvicorn mcp_server.server:app --reload --port 8010

# Docker dev stack (port 3001)
cd docker && make dev-up

# Docker main stack (port 3000)
cd docker && make up

# Frontend dev (main branch — port 3000, override)
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

> **RULE: Only two Gemini models are permitted across the entire project. Do not substitute any other model.**

| Purpose | Model ID |
|---------|----------|
| Default / writing / fast tasks | `gemini-3-flash-preview` |
| Reasoning / planning / complex tasks | `gemini-3.1-pro-preview` |

All LLM calls **must** go through `agent/llm_selector.py::get_llm()` — never instantiate models directly. All employees use Google Gemini via `GOOGLE_API_KEY`. Never configure `agent.config.md`, frontend API routes, or any other code with Anthropic, OpenAI, or any other model names.

Every `agent.config.md` must contain exactly:

```ini
[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview
```

Frontend API routes (e.g. `apps/frontend/src/app/api/onboard/route.ts`) that call an LLM must use `gemini-3-flash-preview` for standard tasks or `gemini-3.1-pro-preview` for reasoning, via `@google/generative-ai` and `GOOGLE_API_KEY`.

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
- Meeting tables (migration `007_meetings`): `meetings`, `meeting_participants`, `meeting_transcriptions`, `meeting_decisions`, `meeting_qa_pairs`, `meeting_agenda_status`, `meeting_mom`
- Supabase Realtime enabled on meeting tables — Chrome extension subscribes directly for agent output

## Meeting App

### Soniox integration
- WebSocket endpoint: `wss://stt-rt.eu.soniox.com/transcribe-websocket` (EU region)
- Auth: API key in initial JSON config message (org-level key stored as `SONIOX_API_KEY`)
- Model: `stt-rt-v4`, speaker diarization enabled, language identification enabled
- The Chrome extension owns the Soniox connection — it captures tab audio via `chrome.tabCapture`, streams binary audio frames to Soniox, accumulates tokens until `is_final=true`, then POSTs completed utterances to `/api/meetings/[id]/utterance`
- Works with any browser-based meeting (Teams, Google Meet, Zoom Web, etc.) — platform-agnostic

### Meeting agent config
Located at `docker/meetings/agents/<agent-id>/config/`:
- `Personality.md` — agent system prompt
- `agent.config.md` — `[meeting_role]`, `[llm_overrides]`, `[capabilities]`

Built-in agents: `decision-logger`, `qa-agent`, `meetings-monitor`

### Fan-out architecture
Every finalized utterance is sent simultaneously to all active agents for the meeting.
Employees join as participants and respond only when directly addressed by name in the transcript.

### Chrome extension
- Manifest V3 side panel (`chrome.sidePanel`)
- Tab audio capture: `chrome.tabCapture` — works on any browser-based meeting tab
- Auth: Supabase JWT stored in `chrome.storage.local`
- Theming: mirrors hub's Tailwind config and CSS variables (dark/light toggle)
- Built artifact is in `apps/chrome-extension/dist/` (gitignored — must run `pnpm build` locally)
- `VITE_HUB_URL` in `apps/chrome-extension/.env` controls which backend the extension talks to (`http://localhost:3001` for dev stack, `http://localhost:3000` for main stack)
- After changing `VITE_HUB_URL`: run `pnpm build` then reload the extension in `chrome://extensions`

### Extension ↔ meeting-agent session lifecycle
- The extension always calls `POST /api/meetings/[id]/start` when opening a meeting, regardless of the meeting's DB status. The meeting-agent handles re-connects gracefully (`already_active` if session exists, or creates a new session if the server restarted). **Do not add a status guard here** — skipping `/start` when status is `active` causes agents to silently not run after a server restart.
- `POST /meetings/[id]/end` on the meeting-agent returns immediately; all teardown (MoM generation, DB status update) runs as a FastAPI `BackgroundTasks` task. The extension fires this call without awaiting the response so navigation is instant.

### Decision logger — known behaviour
- Each utterance is evaluated with the last 5 utterances injected as context so references like "let's go with that" resolve correctly.
- Confidence threshold: `0.65` (lowered from 0.70). Defined as `CONFIDENCE_THRESHOLD` in `agent/agents/decision_logger.py`.
- The decision-logger agent is only instantiated if `decision-logger` is in `meeting_participants` for that meeting. Verify the meeting was created with the agent selected (admin UI defaults all agents to selected).

## Open issues — Employee 1 (Marketing Manager)

- **Human approval gate not tested** — `[human_gate]` config exists in `agent.config.md` but `request_human_approval` tool has not been exercised. Should pause before `publish_external`, `send_email`, `campaign_launch`.
- **No artefacts viewer in frontend** — artefacts stored in Supabase but no UI to browse/read them. To be built as part of the AI Hub frontend.
- **Agent pre-warming** — first request after container start takes ~15s. Consider pre-building agent on startup rather than lazily.
- **hybrid-router MCP server not built** — commented out in `agent.config.md`. Needed for RAG/CAG/SQL tools. Build as part of knowledge pipeline phase.
- **Slack reply formatting** — plain text only. Markdown (bold, bullets) not rendered in Slack; consider using Slack Block Kit for richer output.

## Supabase MCP — paused, revisit

Goal: connect Claude Code to Supabase via MCP so migrations can be run directly from the session.

Steps completed:
- `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` — added to local config
- Supabase CLI installed via Homebrew
- `supabase login` run but token not stored (flow didn't complete)
- Project ref: `onbpmhmmaoyywuqoyjmd`

**To resume:** generate a personal access token at https://supabase.com/dashboard/account/tokens (starts with `sbp_`), then run:
```bash
claude mcp add --transport http supabase \
  'https://mcp.supabase.com/mcp?apikey=<token>&project_ref=onbpmhmmaoyywuqoyjmd'
```

---

## Frontend backlog

### Feature: Task Management (Kanban) — BUILT, needs env vars + DB migration

Kanban board with columns: `Backlog → In Progress → Awaiting Approval → Done`.

**Design principles:**
- All task operations go through a `TaskProvider` interface so Jira/MS Planner can be plugged in later
- Default implementation: Supabase

**Build steps:**
1. Supabase migration — `tasks` table (id, title, description, status, assigned\_to employee\_id, created\_at, due\_date, linked artefact\_id)
2. Task interface (`lib/tasks/types.ts`) — `Task`, `TaskStatus`, `TaskProvider` interface
3. Supabase adapter (`lib/tasks/supabase-adapter.ts`) — implements `TaskProvider`
4. API routes — `/api/tasks` (CRUD), `/api/tasks/[id]/approve`
5. Kanban page (`/tasks/page.tsx`) — drag-and-drop columns, assign to employee, delegate button (sends task to employee via chat), approve/close button on "Awaiting Approval" cards
6. Enable Tasks nav item on home page
7. **Slack task creation** — extend `apps/config-api/slack_router.py` to detect task-creation intent:
   - If message is in an employee channel and mentions `@bot` with task-like phrasing → create task in Supabase assigned to that employee, reply with confirmation + task link
   - If message is in a general/backlog channel (e.g. `#backlog`) → create unassigned task in Backlog column
   - Use Gemini (`gemini-3-flash-preview`) to classify intent and extract title/description from the message

### Feature: Document Template System — BACKLOG

JSON-schema-driven templates for documents produced by employees.

**Design principles:**
- Templates stored in Supabase (`templates` table)
- Selectable when delegating a task; injected into agent system prompt
- Interface-based so template storage can be swapped

**Build steps:**
1. Supabase migration — `templates` table (id, name, description, content\_type, schema JSON, category)
2. Template interface (`lib/templates/types.ts`) — `DocumentTemplate`, `TemplateField`
3. API routes — `/api/templates` (CRUD)
4. Templates page (`/templates/page.tsx`) — list, create, edit templates with JSON schema editor
5. Wire templates into task delegation flow — selected template injected into agent prompt on delegate

---

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
| Meeting audio | Soniox (`stt-rt-v4`, EU endpoint) |
