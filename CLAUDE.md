# CLAUDE.md

Guidance for Claude Code and other coding assistants working in this repository. Humans: the same rules apply.

## What this is

Brage AI Hub: a Turborepo-style monorepo (no root install) with five apps.

- `apps/employee-agent` — Python. One container per virtual employee. `agent/graph.py` builds a Deep Agents agent (LangGraph) from the mounted `/app/config`; `mcp_server/server.py` exposes `/chat`, `/task`, `/resume`, `/health`.
- `apps/config-api` — Python FastAPI. Reads/writes employee config files and reloads containers (SIGHUP over the Docker socket), routes Slack (Socket Mode), stores tasks, runs the scheduler, publishes artefacts, and serves `POST /llm/generate`, the single LLM gateway for non-agent calls.
- `apps/meeting-agent` — Python FastAPI. One `MeetingSession` per active meeting; fans every finalized utterance out to `decision-logger`, `qa-agent`, `meetings-monitor` and to employees addressed by name.
- `apps/frontend` — Next.js 14 App Router. Hub UI and API routes. Dark teal theme with light/dark toggle.
- `apps/chrome-extension` — Manifest V3 side panel. Captures tab + mic audio, streams to Soniox, posts utterances to the hub, subscribes to Supabase Realtime.

## Conventions that matter

1. **Every model call goes through `llm_selector.get_llm()`.** The same file lives in all three Python apps. Never instantiate a provider class directly, and never call a provider SDK from the frontend: Next.js routes call `lib/llm.ts`, which hits config-api's `/llm/generate`. This is what makes `PRIVACY_MODE` and tracing apply everywhere.
2. **Model ids are configuration, not code.** Defaults come from `DEFAULT_LLM` / `REASONING_LLM`; per-employee overrides from `[llm_overrides]` in `agent.config.md`. Supported prefixes: `gemini-*`, `claude-*`, `gpt-*`/`o*`, `ollama/<model>`. The shipped defaults are Gemini Flash (write) and Gemini Pro (reason).
3. **Conversations run on LangGraph threads.** `/chat` and `/task` take an optional `thread_id`; reuse it to keep history. The frontend chat panel, Slack threads (`slack-<channel>-<ts>`) and tasks (`task-<id>`) each own a thread. The human gate (`request_human_approval`) interrupts the graph; answer it with `POST /resume/{employee_id}`. The checkpointer is in-memory; state is lost on restart.
4. **Tracing is opt-in and tagged.** `LANGCHAIN_TRACING_V2=false` by default. The employee server attaches `tags=[employee_id]` and `metadata.employee_id`; the meeting agents use `agent/tracing.py::run_config()` with `meeting_id` and `agent_id`. Keep these when adding calls; the admin usage page groups by them.
5. **Deliverables go to Supabase, not the virtual filesystem.** Agents are told to call `store_result`; `write_file` is scratch space. Tasks are created with `create_task`.
6. **No secrets, project ids or company data in the repo.** Use `.env` (ignored) and `.env.example` (placeholders). Example employees under `docker/employees/` are deliberately generic enough to publish.
7. **Dependencies are pinned.** Edit `requirements.in`, then regenerate `requirements.txt` (see CONTRIBUTING.md). Node apps use `pnpm` with lockfiles; run `pnpm install --frozen-lockfile`.
8. **After a code change, restart the affected service** so the running stack reflects it: `cd docker && make rebuild-<service>` or `make up`. The frontend dev server hot-reloads.

## Key commands

```bash
# Local stack (frontend on :3000)
cd docker && make up                    # make down / make logs / make rebuild-frontend ...
PRIVACY_MODE=true docker compose --env-file ../.env -f docker-compose.local.yml --profile privacy up

# Optional second stack (frontend on :3001, separate network)
cd docker && make dev-up

# Python apps — identical layout
cd apps/employee-agent && pip install -r requirements.txt -r requirements-dev.txt
uvicorn mcp_server.server:app --reload --port 8000
ruff check . && pytest -q
cd apps/config-api     && uvicorn main:app --reload --port 8090
cd apps/meeting-agent  && uvicorn mcp_server.server:app --reload --port 8010

# Frontend / extension
cd apps/frontend && pnpm install && pnpm dev           # :3001
pnpm lint && pnpm typecheck && pnpm build
cd apps/chrome-extension && pnpm install && pnpm build # load dist/ unpacked
```

## Employee configuration

`docker/employees/<employee-id>/config/`, bind-mounted to `/app/config`:
- `Strategy.md` — role, goals, deliverables, decision authority. Injected into the system prompt.
- `Personality.md` — tone and values. Injected into the system prompt.
- `skills/*.md` — one capability per file, loaded natively by Deep Agents (`skills=`).
- `agent.config.md` — INI blocks `[mcp_servers]`, `[llm_overrides]` (`reason`, `write`), `[human_gate]` (`require_approval_for`). Never injected into the prompt.

Adding an employee: copy a folder (or `docs/employee-template/`), add a service block in `docker/docker-compose.local.yml` (same anchors, new `EMPLOYEE_ID`, port and Slack channel), add its URL to `x-employee-urls` and the Slack routing map. The onboarding assistant in the UI drafts these files from a conversation.

## Meeting app

- Soniox: `wss://stt-rt.eu.soniox.com/transcribe-websocket`, model `stt-rt-v4`, diarization and language identification on. The extension owns the WebSocket; the hub only hands out the key (`/api/meetings/soniox-config`).
- The extension always calls `POST /api/meetings/[id]/start` when opening a meeting. The meeting-agent handles reconnects (`already_active`) and server restarts. Do not add a status guard there.
- `POST /meetings/[id]/end` returns immediately; MoM generation runs as a background task.
- Decision logger: last 5 utterances are passed as context; confidence threshold `0.65` (`CONFIDENCE_THRESHOLD` in `agent/agents/decision_logger.py`). An agent only runs if it is in `meeting_participants` for that meeting.
- Meeting agent configs: `docker/meetings/agents/<agent-id>/config/` (`Personality.md`, `agent.config.md`).

## Supabase

Migrations in `supabase/migrations/` (001 artefacts, 002 tasks, 003 attachments, 004 document templates, 005 enhancements, 006 publishing, 007 meetings). Realtime is enabled on the meeting tables. Row level security is not configured yet; see SECURITY.md.

## Slack

Single bot in Socket Mode (`SLACK_APP_TOKEN` is the `xapp-` token). Channel-to-employee routing is the `SLACK_CHANNEL_ROUTING` JSON on config-api; the bot must be invited to each channel. Messages in backlog channels become tasks. A reply of `approve` / `reject` in a thread answers a pending human gate.

## Testing

Each Python app has `tests/`; run `pytest -q` from the app directory. `tests/test_server_threads.py` in employee-agent drives the chat/resume endpoints with a fake LangGraph graph and no LLM. CI runs lint, typecheck, build and tests per app.
