# Brage AI Hub

[![CI](https://github.com/cblom-brageai/brage-ai-hub-oss/actions/workflows/ci.yml/badge.svg)](https://github.com/cblom-brageai/brage-ai-hub-oss/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**A self-hosted hub for AI virtual employees, and a meeting assistant that brings them into your calls.**

A virtual employee is a container running a [Deep Agents](https://github.com/langchain-ai/deepagents) agent on LangGraph, configured entirely with Markdown: a strategy, a personality and a folder of skills. Employees talk to people in a web UI and in Slack, pick up work from a shared task board, keep their deliverables in Supabase, publish approved work to LinkedIn, HubSpot or Slack, and can sit in on browser-based meetings through a Chrome extension that transcribes the call so agents can log decisions, answer questions and write the minutes.

Brage AI built this to run its own company functions in the renewable-energy sector. The six example employees in `docker/employees/` are the ones it uses: marketing manager, bid manager, project manager, quality manager, O&M engineer and developer. Replace them with yours.

---

## Contents

- [What it does](#what-it-does)
  - [Virtual employees](#virtual-employees)
  - [Chat, memory and the human approval gate](#chat-memory-and-the-human-approval-gate)
  - [Slack integration](#slack-integration)
  - [Task management](#task-management)
  - [Scheduler](#scheduler)
  - [Documents, templates and publishing](#documents-templates-and-publishing)
  - [Onboarding assistant and config editor](#onboarding-assistant-and-config-editor)
  - [Meeting Hub](#meeting-hub)
  - [Admin dashboards](#admin-dashboards)
  - [LLM providers and privacy mode](#llm-providers-and-privacy-mode)
  - [Observability](#observability)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Extending the hub](#extending-the-hub)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Documentation](#documentation)
- [Contributing, security, license](#contributing)

---

## What it does

Everything below is implemented in this repository; file references point at the code that does it.

### Virtual employees

`apps/employee-agent`, one container per employee, all from the same image.

- **Configured in Markdown.** `Strategy.md` (role, goals, deliverables, decision authority) and `Personality.md` are injected into the system prompt. `skills/*.md` are loaded natively by Deep Agents and read on demand. `agent.config.md` holds machine-readable INI blocks: `[mcp_servers]`, `[llm_overrides]`, `[human_gate]`. See [docs/employees.md](docs/employees.md).
- **Deep Agents runtime** (`agent/graph.py`): planning with `write_todos`, a sandboxed virtual filesystem rooted at the config folder (`FilesystemBackend(virtual_mode=True)`), sub-agents and skills come from the SDK.
- **Built-in tools** (`agent/tools/`): `store_result` saves a finished deliverable to the `artefacts` table (with optional template id and metadata); `list_artefacts` and `read_artefact` find and reread earlier work; `create_task` adds backlog items, including recurring ones with a cron expression; `send_message` posts to Slack; `request_human_approval` pauses the agent until a person answers.
- **MCP tools.** Every server listed under `[mcp_servers]` is connected with `langchain-mcp-adapters` over streamable HTTP and its tools become agent tools. The example developer employee uses the GitHub MCP server container for repos, pull requests, issues and actions. Unreachable servers are skipped, not fatal.
- **Per-employee models.** `[llm_overrides]` picks the planning (`reason`) and writing (`write`) models for one employee; otherwise the environment defaults apply.
- **Live reload.** Saving a config file in the UI makes config-api send `SIGHUP` to the container; the agent is rebuilt on the next request (about 15 seconds).
- **HTTP API** (`mcp_server/server.py`): `POST /chat/{id}`, `POST /task/{id}`, `POST /resume/{id}`, `GET /health`.

### Chat, memory and the human approval gate

- Every conversation runs on a LangGraph thread. The chat panel keeps one thread until you press reset, so the employee remembers the earlier turns; Slack threads and tasks get their own threads. State lives in an in-memory checkpointer and is lost on container restart ([docs/observability.md](docs/observability.md)).
- When an employee calls `request_human_approval` (for the actions listed under `[human_gate]`, such as publishing externally or sending email), the graph interrupts. The chat panel shows the draft with Approve and Reject buttons and an optional feedback box; in Slack, a reply of `approve` or `reject` in the thread answers it. The agent then continues with the reviewer's answer.

### Slack integration

`apps/config-api/slack_router.py`, one bot for all employees, Socket Mode (no public URL).

- **Channels mapped to employees.** `SLACK_CHANNEL_ROUTING` is a JSON map from channel name (or id) to employee id. The shipped compose file routes `#marketing` and `#general` to the marketing manager, `#tenders` to the bid manager, `#projects` to the project manager, `#quality` to the quality manager, `#operations` to the O&M engineer and `#dev` / `#software` to the developer. Unmapped channels and DMs go to `DEFAULT_EMPLOYEE`. Each employee also has a `SLACK_DEFAULT_CHANNEL` for messages it sends on its own.
- **Thread replies.** The bot reacts with an hourglass while the employee works and posts the answer in the thread. The employee is told which thread it is in so it can reply to a different channel when that is the point.
- **Files.** Uploaded PDFs are text-extracted (`pypdf`), plain text is inlined, other files are referenced by name; attachments on task-like messages are stored with the task and handed to the employee when the task is delegated.
- **Messages become tasks.** Each message is classified (through the LLM gateway) as a task request or a conversational message. Task requests in an employee channel create a task assigned to that employee; messages in `SLACK_BACKLOG_CHANNELS` create unassigned backlog items. A deadline or recurrence in the text ("every Monday at 9") becomes `scheduled_at` or a cron `recurrence`.
- **Approvals in-thread.** When a delegated or scheduled task completes, a preview of the result is posted back in the originating thread as "awaiting approval"; replying `approve` or ✅ marks it done and fires any auto-publish rules. Replying in a thread where an employee asked for human approval resumes that employee.
- **Slash commands.** `/mm` and `/bm` route text to the marketing and bid managers; the map is `COMMAND_ROUTING` in `slack_router.py`.

### Task management

`apps/frontend/src/app/tasks/page.tsx`, `apps/frontend/src/lib/tasks/`, `apps/config-api/task_store.py`, migrations `002`, `003`, `005`.

- **Kanban board** with the columns Backlog, In Progress, Awaiting Approval and Done, drag-and-drop between them.
- **Tasks** have a title, description, assignee, origin (`web`, `slack` or `scheduled`), optional document template, optional one-off schedule or cron recurrence (presets for daily, weekdays, weekly, monthly, or a custom expression), attachments, and a link to the artefact the employee produced.
- **Delegate** sends the task to its employee with the attachments' text and, if a template is set, the template's JSON Schema so the result is structured. The result is stored as an artefact linked to the task and the task moves to Awaiting Approval.
- **Approve** marks the task done and publishes the linked artefact through every rule of that employee whose trigger is `approved`.
- **Employees create tasks too.** When asked to turn a plan, calendar or roadmap into work items, an employee calls `create_task` once per item instead of writing the content itself; the system prompt makes this "plan versus do" distinction explicit.
- **Replaceable backend.** The web UI goes through the `TaskProvider` interface (`lib/tasks/types.ts`: `list`, `get`, `create`, `update`, `remove` over a `Task` type with the four statuses). The shipped implementation is `supabase-adapter.ts`; an adapter for Jira, Microsoft Planner, Linear or similar implements the same five calls and maps their statuses onto the four columns. The server-side counterpart used by Slack and the scheduler is `task_store.py` in config-api, which talks to Supabase REST and would need the matching adapter.

### Scheduler

`apps/config-api/scheduler.py`. An APScheduler job ticks every minute, picks tasks whose `next_run_at` is due, marks them in progress, delegates them to their employee and, for recurring tasks, computes the next run from the cron expression (`croniter`). Results are posted into the originating Slack thread when there is one and the task moves to Awaiting Approval (one-off) or back to Backlog (recurring).

### Documents, templates and publishing

`apps/frontend/src/app/documents/`, `apps/config-api/publishers/`, migrations `001`, `004`, `005`, `006`.

- **Artefacts** are everything employees produce: Markdown with a title, filename, source, optional metadata JSON, template link and schema version, stored in Supabase and searchable with Postgres full-text search. The Documents page lists them, renders the Markdown, lets you edit and save, and publishes them.
- **Templates** describe a document type as sections of typed fields (text, long text, number, date, dropdown, checklist, list, person), stored in `document_templates.json_schema`. The **Template Studio** (`/documents/studio`) is a visual builder with a JSON view and a live preview; describe the document in a sentence and the hub drafts the sections and fields through the LLM gateway. Assign a template to employees and attach it to a task so the employee produces structured output.
- **Document writer** (`/documents/write`): pick a template, fill in the form with a live Markdown preview, and save it as an artefact on behalf of an employee or the hub user. The form data is kept with the artefact so the document reopens in the form later. Details in [docs/documentation-hub.md](docs/documentation-hub.md).
- **Publish channels** are configured in the UI with per-channel settings and a list of employees allowed to use them: **LinkedIn** (UGC post), **HubSpot** (CMS blog post), **Slack** (formatted message) and **Word to Slack** (a `.docx` generated from the Markdown and uploaded to a channel).
- **Publish rules** bind an employee to a channel with a trigger: `approved` publishes automatically when a task is approved, `manual` publishes from the document page. Every attempt is recorded in `publish_logs` with status and error.

### Onboarding assistant and config editor

- **New employee** (`/employees/new`): a conversation with the onboarding assistant that asks about the role, responsibilities, goals, personality and skills, then emits a configuration block that the hub writes as `Strategy.md`, `Personality.md`, `agent.config.md` and `skills/*.md` under `docker/employees/<id>/`. Add the matching service to the compose file to start it.
- **Config editor** (`/employees/<id>/config`): tabs for Strategy, Personality, Skills (create, edit, delete skill files) and agent config, with Save and Reload buttons; the editor talks to config-api, which can also commit each change to git (`GIT_ENABLED=true`).
- **LLM config** (`/admin/employees`): the reasoning and writing model per employee, with reload.

### Meeting Hub

`apps/chrome-extension`, `apps/meeting-agent`, `/admin/meetings`, migration `007`. Full guide in [docs/meeting-extension.md](docs/meeting-extension.md).

- **Chrome extension** (Manifest V3 side panel): captures the meeting tab's audio and your microphone, streams both to Soniox (`stt-rt-v4`, speaker diarisation, language identification, language hints per meeting), and posts each finalized utterance to the hub. Works with Microsoft Teams, Google Meet, Zoom web and any other browser-based meeting. Login with a Supabase user; live transcript, decisions, answers and agenda status arrive over Supabase Realtime; a chat box sends questions to the agents.
- **Meetings** have a title, description, scheduled time, agenda items, language hints and participants; participants are built-in agents, employees or both. Admin pages list meetings and show each meeting's transcript, decisions, Q&A, agenda progress and minutes.
- **Meeting agents** run on every utterance, in parallel:
  - **Decision logger** detects decisions with structured output and a confidence threshold, using the previous five utterances as context so "let's go with that" resolves.
  - **Q&A agent** detects questions asked aloud or typed in the panel, searches the artefact store, answers in two to four sentences and cites the source document.
  - **Meetings monitor** tracks which agenda item is being discussed (pending, in progress, completed, skipped) and, when the meeting ends, writes the minutes: agenda outcome, decisions, questions and answers, action items with owners and dates, open items.
  - **Employees** invited to a meeting respond when addressed by name, and their answers appear in the panel.
- Each meeting agent has its own `Personality.md` and `agent.config.md` under `docker/meetings/agents/`.

### Admin dashboards

- **Admin dashboard** (`/admin`): requests per day, token usage and cost per employee (from LangSmith when a key is configured), task origin per employee (chat, Slack, scheduled) and artefacts per employee (from Supabase), over a selectable number of days.
- **Employee overview** (home page): every folder under `docker/employees/` with its skills, and shortcuts to chat and configuration.

### LLM providers and privacy mode

- One factory, `llm_selector.get_llm()`, in every Python service; the frontend's model calls go through config-api's `POST /llm/generate`. Supported ids: `gemini-*`, `claude-*`, `gpt-*` / `o*`, `ollama/<model>`. Defaults come from `DEFAULT_LLM` and `REASONING_LLM`; employees and meeting agents can override them.
- `PRIVACY_MODE=true` sends every model call to a local Ollama server. Transcription (Soniox) and a hosted Supabase remain external; see [docs/privacy-mode.md](docs/privacy-mode.md).

### Observability

LangSmith tracing is a configuration switch, off by default. Runs are tagged per employee, per meeting and per gateway caller so the admin dashboard can aggregate them. Details and limits in [docs/observability.md](docs/observability.md).

---

## Architecture

```
                 ┌──────────────────────────┐        ┌───────────────────────────┐
  Browser  ───▶  │ frontend (Next.js :3000) │ ─────▶ │ employee-<id> (:8001…)    │
                 │ chat · tasks · documents │        │ Deep Agents on LangGraph  │──▶ LLM provider
  Chrome   ───▶  │ meetings admin · API     │        │ tools · MCP clients       │    or Ollama
  extension      └────────────┬─────────────┘        └──────────┬────────────────┘
      │                       │                                 │
      │  utterances           ▼                                 ▼
      │              ┌──────────────────┐   SIGHUP     ┌──────────────────┐
      └────────────▶ │ meeting-agent    │ ◀─────────── │ config-api :8090 │ ◀── Slack (Socket Mode)
                     │ decision · Q&A   │              │ configs · tasks  │
                     │ monitor · MoM    │              │ scheduler · LLM  │──▶ LinkedIn · HubSpot
                     └────────┬─────────┘              │ gateway · publish│    Slack · Word
                              │                        └────────┬─────────┘
                              ▼                                 ▼
                     ┌────────────────────────────────────────────────┐
                     │ Supabase: artefacts · tasks · templates ·      │
                     │ publishing · meetings · realtime               │
                     └────────────────────────────────────────────────┘
```

| Service | Stack | Role |
|---|---|---|
| `apps/employee-agent` | Python, Deep Agents, LangGraph, FastAPI | One instance per employee. Builds the agent from the mounted config; `/chat`, `/task`, `/resume`. |
| `apps/config-api` | Python, FastAPI | Config files and live reload, Slack router, task store, scheduler, publishers, LLM gateway. |
| `apps/meeting-agent` | Python, FastAPI, LangChain | One session per active meeting; fans utterances out to meeting agents and invited employees. |
| `apps/frontend` | Next.js 14, Tailwind | The hub UI and its API routes. |
| `apps/chrome-extension` | Vite, React, Manifest V3 | Side panel for meetings. |
| `supabase/migrations` | SQL | Artefacts, tasks, attachments, templates, publishing, meetings. |

## Quick start

Prerequisites: Docker, a [Supabase](https://supabase.com) project (hosted or self-hosted), and either an API key for Gemini, Claude or OpenAI, or a machine that can run [Ollama](https://ollama.com).

```bash
git clone https://github.com/cblom-brageai/brage-ai-hub-oss.git
cd brage-ai-hub-oss
cp .env.example .env            # fill in SUPABASE_URL, SUPABASE_KEY and one LLM key
```

Apply `supabase/migrations/001…007` in order with the Supabase SQL editor or CLI, then start the stack:

```bash
cd docker && make up            # frontend on http://localhost:3000
```

The first message to an employee takes about fifteen seconds while its agent is built.

**Privacy mode (local models only)**

```bash
PRIVACY_MODE=true docker compose --env-file ../.env -f docker-compose.local.yml --profile privacy up
docker exec ollama ollama pull llama3.1:8b     # or any model; set OLLAMA_MODEL to match
```

**Meeting extension**

```bash
cd apps/chrome-extension && pnpm install && pnpm build
```

Load `apps/chrome-extension/dist` as an unpacked extension at `chrome://extensions`, open your meeting tab, click the extension icon, log in and pick or create a meeting. Transcription needs `SONIOX_API_KEY` in `.env`.

**Slack**

Create a Slack app with Socket Mode, a bot token (`xoxb-`) and an app-level token (`xapp-`), subscribe to `message.channels` and `message.im`, put both tokens in `.env`, invite the bot to your channels and map them in `SLACK_CHANNEL_ROUTING` (compose file).

## Configuration

Everything is driven by `.env` ([.env.example](.env.example)). The important variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Database, artefact storage and realtime. |
| `DEFAULT_LLM`, `REASONING_LLM` | Default model ids for writing and for planning. |
| `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Only the provider you use needs a key. |
| `PRIVACY_MODE`, `OLLAMA_MODEL` | Route every call to local Ollama. |
| `COMPANY_NAME`, `COMPANY_DESCRIPTION` | Shown to the agents and the onboarding assistant. |
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | Slack Socket Mode bot. |
| `SLACK_CHANNEL_ROUTING`, `SLACK_BACKLOG_CHANNELS` | Channel to employee map and backlog channels (set on config-api in the compose file). |
| `SONIOX_API_KEY` | Real-time transcription for meetings. |
| `GITHUB_TOKEN` | GitHub MCP server used by the developer employee. |
| `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY` | LangSmith tracing, off by default. |
| `GIT_ENABLED` | Commit config changes made in the UI to git. |

## Extending the hub

| To add | Do this |
|---|---|
| An employee | Copy `docs/employee-template/` to `docker/employees/<id>/config/`, add a service block to `docker/docker-compose.local.yml` (same anchors; new id, port, Slack channel), add its URL to `x-employee-urls` and the channel to `SLACK_CHANNEL_ROUTING`. Or let the onboarding assistant write the files. |
| Tools for an employee | Run any MCP server and list it under `[mcp_servers]` in that employee's `agent.config.md`. |
| A field type for templates | Add it to `FieldType` and `FIELD_TYPES` in `apps/frontend/src/lib/templates/types.ts`, render it in `components/document-form/dynamic-field.tsx`, and teach `renderMarkdown` in `lib/templates/structure.ts` how to print it. |
| A publish channel type | Add a module under `apps/config-api/publishers/`, a branch in `dispatcher.py`, and the type to the `CHECK` constraint in migration `006`. |
| A meeting agent | A class in `apps/meeting-agent/agent/agents/`, wired into `MeetingSession`, plus a config folder under `docker/meetings/agents/`. |
| Another task backend | Implement `TaskProvider` (`apps/frontend/src/lib/tasks/types.ts`) and the matching functions in `apps/config-api/task_store.py`. |
| An LLM provider | A branch in `llm_selector.py` (same file in the three Python apps) and its package in `requirements.in`. |

## Repository layout

```
apps/employee-agent/      agent runtime: graph.py, llm_selector.py, tools/, mcp_server/server.py, tests/
apps/config-api/          main.py (config, tasks, publishing, /llm/generate), slack_router.py, scheduler.py, publishers/
apps/meeting-agent/       session.py and agents/ (decision_logger, qa_agent, meetings_monitor), tools/
apps/frontend/            Next.js hub: app/ pages and API routes, components/, lib/ (tasks, meetings, llm)
apps/chrome-extension/    side panel: sidepanel/ (hooks, components), background.ts, mic-bridge.ts
docker/                   compose stacks, Makefile, employees/ (examples), meetings/agents/
supabase/migrations/      database schema 001…007
docs/                     guides, roadmap, employee template, original specification
```

## Development

Each app is developed on its own; there is no root install.

```bash
# Python apps (employee-agent, config-api, meeting-agent)
cd apps/employee-agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check . && pytest -q

# Frontend
cd apps/frontend && pnpm install --frozen-lockfile && pnpm dev   # :3001, against a running stack
pnpm lint && pnpm typecheck && pnpm build

# Chrome extension
cd apps/chrome-extension && pnpm install --frozen-lockfile && pnpm dev   # rebuilds dist/ on change
```

Dependencies are pinned (`requirements.txt`, `pnpm-lock.yaml`); [CONTRIBUTING.md](CONTRIBUTING.md) explains how to update them. The unit tests run without any LLM or database: the employee server is tested against a small LangGraph graph with an interrupt, the LLM gateway against a fake chat model, and the template helpers with Vitest (`pnpm test` in `apps/frontend`). [CLAUDE.md](CLAUDE.md) lists the conventions that AI coding assistants and humans should follow here.

## Documentation

- [docs/employees.md](docs/employees.md): configuration files, tools, Slack, adding an employee
- [docs/documentation-hub.md](docs/documentation-hub.md): the template structure, the Template Studio and the document writer
- [docs/meeting-extension.md](docs/meeting-extension.md): building, loading and using the meeting assistant
- [docs/privacy-mode.md](docs/privacy-mode.md): model selection, local models and data boundaries
- [docs/observability.md](docs/observability.md): tracing, run tags, the usage dashboard, conversation state
- [docs/ROADMAP.md](docs/ROADMAP.md): known gaps and planned modules
- [docs/specification-v2.1.md](docs/specification-v2.1.md): the original design specification
- [SECURITY.md](SECURITY.md): security model and known limitations; read it before exposing a stack

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. Security problems go through private vulnerability reporting, see [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Built with [Deep Agents](https://github.com/langchain-ai/deepagents), [LangGraph](https://github.com/langchain-ai/langgraph), [LangChain](https://github.com/langchain-ai/langchain), [Supabase](https://supabase.com), [Next.js](https://nextjs.org) and [Soniox](https://soniox.com).
