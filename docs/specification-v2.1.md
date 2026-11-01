# Brage AI Hub — Software Specification v2.1

> Original design specification (March 2026), converted from the Word document that shipped with the repository. It describes the v2.1 design delta: the move to the Deep Agents SDK and the configuration web editor. Where the code has since diverged, the code wins; see README.md and docs/ for current behaviour.

BRAGE AI HUB

Software Specification  v2.1

Deep Agents SDK • MCP Integration • Config Web Editor • Standalone Employee

March 2026  •  Brage AI

> What is new in v2.1 Two targeted updates over v2. First: the hand-rolled 8-node LangGraph StateGraph is replaced by the Deep Agents SDK (deepagents package), which provides built-in task planning, a virtual filesystem, and sub-agent spawning out of the box. Custom nodes (human gate, communicate, store_result) are layered on top. MCP tools integrate via langchain-mcp-adapters. Second: the Management UI gains a full Markdown web editor for employee configuration files (Strategy.md, Skills.md, Personality.md) and a JSON Schema editor for templates, backed by a Config API that writes to the mounted config volume and triggers a live reload of the target employee container.

## 1. System Overview

Brage AI Hub is a platform for deploying autonomous Virtual Employees. Each employee is a containerised AI agent with its own strategy, skills, knowledge, personality, and communication channels. The architecture is MCP-native: agents expose an MCP server to the platform and consume tool MCP servers outbound.

v2.1 updates the agent runtime from a custom LangGraph StateGraph to the Deep Agents SDK, and adds a Markdown web editor in the Management UI so administrators can edit employee configuration files directly in a browser. All other architecture (containerisation, Hybrid Router, LLM Selector, LangSmith tracing, Slack/Gmail setup, Standalone mode) is unchanged from v2.

> **Standalone First** — An employee container can be started with docker compose -f docker-compose.standalone.yml up and tested fully before any platform services are built. The Deep Agents SDK and Config Editor do not change this principle.

## 2. Agent Architecture — Deep Agents SDK

The Virtual Employee agent runtime is built on the Deep Agents SDK (deepagents Python package), which is itself built on LangGraph. Deep Agents provides batteries-included capabilities that the v2 spec implemented manually, significantly reducing the amount of custom graph code required.

### 2.1 What Deep Agents Provides

| Deep Agents Capability | How It Is Used in Brage AI Hub |
|---|---|
| Built-in write_todos planning tool | Replaces the custom plan node. The agent automatically breaks every incoming task into discrete steps and tracks their completion. No custom planning prompt engineering required. |
| Virtual filesystem (read_file, write_file, edit_file, ls) | Replaces custom artefact handling. Agents write intermediate research, drafts, and final documents to the filesystem backend. For production, the LangGraph Store backend is used so artefacts persist across threads. In standalone mode, the local disk backend writes to /app/config/artefacts/. |
| Built-in sub-agent spawning (task tool) | Replaces the custom multi-agent pattern. Complex tasks (e.g. 'produce the quarterly report') delegate to a specialised sub-agent that runs in a clean context, returns a result, and terminates — keeping the parent agent's context clean. |
| Long-term memory via LangGraph Memory Store | Each employee accumulates memories across task executions: learned preferences, past decision outcomes, entity facts. Retrieved at the start of each new task execution. |
| MCP tool integration via langchain-mcp-adapters | The outbound MCP client registry (Hybrid Router, Gmail, Slack, etc.) converts MCP tool schemas into LangChain BaseTool instances that Deep Agents treats as native tools. Zero custom adapter code needed. |

### 2.2 What Is Custom (Layered on Top of Deep Agents)

Deep Agents handles planning, file management, sub-agents, and the core reasoning loop. The following are Brage-specific additions:

| Custom Addition | Description |
|---|---|
| human_gate interrupt | LangGraph interrupt() — used natively, since Deep Agents is built on LangGraph and inherits its full human-in-the-loop support. Wrapped as a registered @tool so the Deep Agent can call it during its reasoning loop. Exposes submit_human_response on the inbound MCP server to resume execution. |
| communicate node | Channel dispatch logic (Gmail send, Slack send, voice call). Wrapped as a LangChain tool and registered with the agent so Deep Agents can invoke it in its execution loop. |
| store_result node | Persists artefacts to object storage, updates task status via the Task Manager MCP, and writes the audit log. Also a registered tool. |
| LLM Selector integration | The model= parameter of create_deep_agent() is supplied by the LLMSelector.get_llm() factory, enabling privacy mode and per-employee model overrides. |
| System prompt injection | Only Strategy.md and Personality.md are injected into system_prompt=. Skills.md is not included in the prompt — the agent discovers what it can do through registered tool schemas (from MCP servers), not from a text description. Skills.md is parsed solely for the [mcp_servers] block and configuration settings such as [llm_overrides] and [human_gate]. |

### 2.3 Agent Initialisation Code

```
# agent/graph.py
import os
from deepagents import create_deep_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from agent.llm_selector import get_llm
from agent.config_loader import load_config
from agent.tools import human_gate_tool, communicate_tool, store_result_tool

async def build_agent(employee_id: str):
    config = load_config()  # reads Strategy.md, Skills.md, Personality.md

    # ── Build system prompt from config files ──────────────────────
    system_prompt = f"""
    <identity>
    You are {config.employee_name}.
    </identity>

    <strategy>
    {config.strategy_md}
    </strategy>

    # NOTE: Skills.md is NOT injected into the system prompt.
    # The agent discovers capabilities through registered MCP tool schemas.
    # Skills.md is parsed only for [mcp_servers], [llm_overrides], [human_gate].

    <personality>
    {config.personality_md}
    </personality>
    """

    # ── Connect to outbound MCP tool servers ───────────────────────
    mcp_servers = config.mcp_servers  # parsed from Skills.md [mcp_servers]
    mcp_client  = MultiServerMCPClient(mcp_servers)
    mcp_tools   = await mcp_client.get_tools()  # converts MCP schemas to LangChain tools

    # ── Brage-specific custom tools ────────────────────────────────
    custom_tools = [human_gate_tool, communicate_tool, store_result_tool]

    # ── Create the Deep Agent ──────────────────────────────────────
    agent = create_deep_agent(
        model         = get_llm(config.llm_overrides.get('reason')),
        tools         = mcp_tools + custom_tools,
        system_prompt = system_prompt,
        # Virtual filesystem backend
        # Use 'disk' in standalone mode, 'langgraph_store' in platform mode
        fs_backend    = os.getenv('FS_BACKEND', 'disk'),
        fs_root       = os.getenv('FS_ROOT', '/app/config/artefacts'),
        # Long-term memory
        store         = build_memory_store(),  # LangGraph InMemoryStore or PostgresStore
    )
    return agent
```

### 2.4 MCP Tool Integration via langchain-mcp-adapters

The langchain-mcp-adapters package converts every tool exposed by an MCP server into a LangChain BaseTool. Deep Agents then sees them as native tools — it can call them, pass them to sub-agents, and reason about them from their descriptions.

```
# mcp_clients/registry.py
from langchain_mcp_adapters.client import MultiServerMCPClient
from agent.config_loader import parse_mcp_servers

async def build_mcp_tools(skills_md: str) -> list:
    """
    Parse [mcp_servers] from Skills.md and return a flat list of
    LangChain tools, one per MCP tool across all connected servers.
    """
    servers = parse_mcp_servers(skills_md)
    # servers = {'hybrid_router': 'http://hybrid-router:9000', ...}

    client = MultiServerMCPClient(
        {name: {'url': url, 'transport': 'streamable_http'}
         for name, url in servers.items()}
    )
    tools = await client.get_tools()
    # Each tool has: name, description (from MCP schema), and
    # invoke() that calls the MCP server transparently.
    return tools
```

### 2.5 Deep Agents Virtual Filesystem Backends

The virtual filesystem is used by the agent to store research notes, draft content, intermediate outputs, and final artefacts. The backend is configurable per deployment:

| FS Backend | FS_BACKEND value | When to Use |
|---|---|---|
| Local disk | disk | Standalone development. Files written to FS_ROOT on the container filesystem (bind-mounted to host). |
| LangGraph Store | langgraph_store | Platform deployment. Artefacts persisted in PostgreSQL via LangGraph's built-in store. Cross-thread and cross-restart durable. |
| In-memory | memory | Unit tests. No disk I/O, no persistence. |
| S3-compatible | s3 | Production object storage (MinIO or AWS S3). Set S3_BUCKET, S3_ENDPOINT_URL env vars. |

### 2.6 Updated Container Directory Structure

```
/app/
├── agent/
│   ├── graph.py              # create_deep_agent() factory (see 2.3)
│   ├── config_loader.py      # reads Strategy.md, Skills.md, Personality.md
│   ├── llm_selector.py       # multi-LLM factory (unchanged from v2)
│   ├── memory.py             # LangGraph Memory Store builder
│   └── tools/                # Brage-specific custom tools
│       ├── human_gate.py         # LangGraph interrupt() wrapper
│       ├── communicate.py        # channel dispatch (Gmail / Slack / voice)
│       └── store_result.py       # artefact persistence + task manager update
├── mcp_server/               # Inbound MCP server (FastMCP, exposes agent to platform)
│   ├── server.py
│   └── models.py
├── mcp_clients/              # Outbound MCP client (langchain-mcp-adapters)
│   └── registry.py
├── channels/                 # Slack listener + Gmail poller (unchanged)
├── config/                   # Mounted volume — editable by humans
│   ├── Strategy.md
│   ├── Skills.md
│   ├── Personality.md
│   ├── templates/
│   └── artefacts/            # Deep Agents FS backend writes here (disk mode)
├── standalone/               # CLI + mock platform
└── tests/
```

### 2.7 Human Gate Implementation with LangGraph Interrupt

Deep Agents runs on LangGraph, so the human-in-the-loop pattern uses LangGraph's native interrupt() mechanism rather than a custom node:

```
# agent/tools/human_gate.py
from langchain_core.tools import tool
from langgraph.types import interrupt
import asyncio, os

@tool
async def request_human_approval(draft_output: str, reason: str) -> str:
    """
    Pause execution and request human approval before proceeding.
    Use this before sending any external communication that requires sign-off,
    as defined in Skills.md [human_gate] require_approval_for.
    Returns the human's response (approval confirmation or feedback to revise).
    """
    # interrupt() pauses the LangGraph execution and surfaces the state
    # to whoever called resume() on the agent's MCP server.
    response = interrupt({
        'draft_output': draft_output,
        'reason': reason,
        'employee_id': os.getenv('EMPLOYEE_ID'),
    })
    # Execution resumes here once submit_human_response is called on the MCP server.
    return response.get('feedback', 'Approved.')
```

### 2.8 Key Dependencies (requirements.txt additions)

```
# Deep Agents SDK
deepagents>=0.1

# MCP tool adapter
langchain-mcp-adapters>=0.1

# LangGraph (required by deepagents; pin for compatibility)
langgraph>=0.2
langgraph-checkpoint-postgres>=1.0   # for LangGraph Store backend

# LangChain model integrations
langchain-core>=0.3
langchain-anthropic>=0.3
langchain-openai>=0.3
langchain-ollama>=0.2

# MCP server
fastmcp>=0.1

# Tracing
langsmith>=0.2

# Existing dependencies from v2 unchanged...
```

## 3. Configuration File Web Editor

Administrators can edit an employee's Strategy.md, Skills.md, Personality.md, and JSON template files directly in a browser without touching the host filesystem. The editor is part of the Management UI and is backed by a Config API service.

### 3.1 Architecture

The Config API is a small FastAPI service that mounts the same config volume as the employee container. It exposes read/write endpoints for each config file. On save, it optionally sends a SIGHUP to the employee container to trigger a live reload without restart.

> **Persistent Storage** — The config files live on a bind-mounted host directory (or a named volume in production). Both the employee container and the Config API container mount the same volume. This means edits made in the browser are immediately visible to the agent on next config reload, and edits made directly on the filesystem (e.g. via Git) are visible in the browser editor.

### 3.2 Config API Endpoints

| Method + Path | Request / Params | Response |
|---|---|---|
| GET /config/:employee_id/files | — | List of config file names and last-modified timestamps |
| GET /config/:employee_id/file/:filename | — | { content: string, last_modified: string } |
| PUT /config/:employee_id/file/:filename | { content: string, reload?: bool } | { saved: true, reloaded: bool } |
| GET /config/:employee_id/templates | — | List of template names and metadata |
| GET /config/:employee_id/template/:name | — | { schema: object, output_format: string } |
| PUT /config/:employee_id/template/:name | { schema: object, output_format: string } | { saved: true } |
| POST /config/:employee_id/template | { name: string, schema: object, output_format: string } | { created: true } |
| DELETE /config/:employee_id/template/:name | — | 204 No Content |
| POST /config/:employee_id/reload | — | Sends SIGHUP to the employee container. { reloaded: bool } |
| GET /config/:employee_id/validate | — | Validates Skills.md MCP server URLs are reachable. Returns status per server. |

### 3.3 Config API — SIGHUP Reload

```
# config_api/reload.py
import subprocess, os

def reload_employee(employee_id: str) -> bool:
    """
    Send SIGHUP to the employee container to reload config files.
    Requires the Config API container to have access to the Docker socket,
    or use a shared IPC mechanism (e.g. Redis pub/sub) in production.
    """
    container_name = f'employee-{employee_id}'
    result = subprocess.run(
        ['docker', 'kill', '--signal', 'SIGHUP', container_name],
        capture_output=True
    )
    return result.returncode == 0

# In the employee container, trap SIGHUP:
# agent/config_loader.py
import signal
_config_cache = {}

def _reload_handler(signum, frame):
    _config_cache.clear()
    print('Config reloaded (SIGHUP received)')

signal.signal(signal.SIGHUP, _reload_handler)
```

### 3.4 Frontend — Employee Config Editor Page

A dedicated page at /employees/:id/config in the Management UI provides the full editing experience. It is split into four tabs:

#### Tab 1 — Strategy Editor

- Full-screen Monaco Editor (the same editor as VS Code) in Markdown mode.
- Live Markdown preview panel alongside the editor (split view, toggleable).
- Word count and reading-time indicator.
- 'Save & Reload Agent' button: calls PUT /config/:id/file/Strategy.md with reload: true, then shows a toast notification confirming the agent reloaded.
- Unsaved changes indicator (dirty state) in the tab title.
#### Tab 2 — Skills Editor

- Monaco Editor in a custom language mode that highlights the [mcp_servers], [llm_overrides], [human_gate], and [gmail_routing] sections with distinct colours.
- 'Validate MCP Servers' button: calls GET /config/:id/validate and shows a green/red status indicator per MCP server URL.
- Inline documentation panel: when the cursor is in a known section, shows the field reference for that section.
- Same 'Save & Reload Agent' button as Strategy tab.
#### Tab 3 — Personality Editor

- Monaco Editor in Markdown mode with live preview.
- 'Preview Message' panel: enter a sample task description and see a simulated opening paragraph from the agent in its configured personality. Calls POST /config/:id/preview-message with the draft Strategy + Personality.
#### Tab 4 — Templates

- List of all templates/*.json files with name, output_format badge, and last-modified date.
- 'New Template' button: opens a modal with template name and output format fields.
- Click any template to open the Template Editor (see section 3.5).
### 3.5 Template Editor

The Template Editor provides two views for editing a JSON Schema template:

#### Visual Builder (default)

- Tree view of the JSON Schema: each field shown as a row with name, type dropdown (string, number, integer, boolean, array, object), required toggle, description text field, and constraints (maxLength, minimum, maximum, enum values).
- Add Field button appends a new field at the current level. Fields are reorderable by drag-and-drop.
- Nested objects and arrays expand/collapse inline.
- Output format selector: DOCX, PDF, Markdown, JSON.
#### Raw JSON Editor

- Monaco Editor in JSON mode with real-time JSON Schema validation (using Ajv against the JSON Schema Draft-07 metaschema).
- Validation errors shown as red underlines with error messages in the Problems panel.
- Toggle back to Visual Builder (re-parses the JSON into the tree view).
#### Preview

- Renders a sample document from the schema using auto-generated placeholder values.
- For DOCX/PDF output formats, calls POST /config/:id/template/:name/preview which invokes the template_fill tool on the employee and returns a downloadable preview file.
### 3.6 Git Integration (Optional)

For teams that want version-controlled config files, the Config API supports an optional Git integration:

- On save, the Config API runs git add + git commit -m 'Update Strategy.md for <employee_name>' on the config volume directory.
- A change history tab in the Config Editor shows the git log for the current file with diff view.
- Rollback button: checks out a previous commit of a single file.
- Enable by setting GIT_ENABLED=true and GIT_AUTHOR_EMAIL on the Config API container.
> **Team Governance** — Git-backed config files provide a natural governance model: meaningful changes to an employee's strategy or skills go through a pull request and code review, creating an audit trail of who changed what and why. Recommended for production deployments.

## 4. Management UI — Updated Route Map

The following routes are added or updated from v2. All other routes from v2 remain unchanged.

| Route | Page Description (new / updated) |
|---|---|
| /employees/:id/config | NEW: Config File Editor. Four-tab layout for Strategy, Skills, Personality, and Templates. Monaco Editor with live preview and Save & Reload. |
| /employees/:id/config/templates/:name | NEW: Template Editor. Visual builder + raw JSON editor + preview. Accessible from the Templates tab. |
| /employees/:id | UPDATED: Employee detail page now includes a 'Edit Config' shortcut button linking to /employees/:id/config. |
| /employees/new | UPDATED: Setup wizard now pre-populates default Strategy.md, Skills.md, and Personality.md content based on the selected role, using role-specific templates that the admin can edit in step 2-4. |

### 4.1 Config Editor Component Architecture (React)

> // frontend/src/pages/EmployeeConfig/index.tsx // Main config editor page. Uses Monaco Editor for all text editing. import Editor from '@monaco-editor/react'; import { useConfigFile, useSaveConfigFile } from '@/api/config'; // Tabs: strategy | skills | personality | templates // Each tab loads content via GET /config/:id/file/:filename // and saves via PUT /config/:id/file/:filename // key libraries: // @monaco-editor/react    — VS Code editor in React // react-markdown          — live Markdown preview // @uiw/react-json-view    — JSON Schema visual tree (template editor) // ajv                     — JSON Schema validation (template editor)

### 4.2 Config API Container (docker-compose entry)

> # docker-compose.yml addition config-api:   image: brage/config-api:latest   ports:     - "8090:8090"   volumes:     - ./employees:/employees        # all employee config directories     - /var/run/docker.sock:/var/run/docker.sock  # for SIGHUP reload   environment:     - CONFIG_ROOT=/employees     - GIT_ENABLED=${GIT_ENABLED:-false}     - GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-}     - API_PORT=8090   restart: unless-stopped # Standalone mode: config-api is also included in docker-compose.standalone.yml # so the editor works during development without the full platform.

## 5. Updated Technical Stack

The following entries are added or changed from v2. All other stack entries are unchanged.

| Component | Technology (updated / new) |
|---|---|
| Agent Runtime | Deep Agents SDK (deepagents Python package) built on LangGraph >=0.2. Provides planning, virtual filesystem, sub-agent spawning, and long-term memory out of the box. |
| MCP Tool Adapter | langchain-mcp-adapters — converts MCP server tool schemas into LangChain BaseTools that Deep Agents can invoke natively. |
| LangGraph Persistence | langgraph-checkpoint-postgres — PostgreSQL-backed checkpoint store for durable agent state and the LangGraph filesystem backend in platform mode. |
| Human Gate | LangGraph interrupt() — native LangGraph human-in-the-loop mechanism. Replaces the custom human_gate node. |
| Config API | FastAPI (Python) — small service exposing read/write endpoints for employee config files. Mounts the same volume as employee containers. |
| Config Web Editor | @monaco-editor/react — VS Code editor embedded in React. Used for Strategy.md, Skills.md, Personality.md, and raw JSON template editing. |
| Markdown Preview | react-markdown with remark-gfm — live preview alongside the Monaco editor in Strategy and Personality tabs. |
| JSON Schema Validation | Ajv (JavaScript) — real-time validation of template JSON schemas against Draft-07 metaschema in the browser. |
| Git Integration (optional) | GitPython (Python) — Config API git add/commit/log on the config volume for version-controlled employee configuration. |

## 6. Updated CLAUDE.md Files

### 6.1 employee-agent/CLAUDE.md (updated)

```
# employee-agent — CLAUDE.md  (v2.1)

## What this is
Standalone Virtual Employee Docker container.
Agent runtime: Deep Agents SDK (deepagents) on top of LangGraph.
MCP tool integration: langchain-mcp-adapters.

## Run standalone
docker compose -f docker-compose.standalone.yml up
python standalone/cli.py chat

## Key files
agent/graph.py          — create_deep_agent() factory (START HERE)
agent/llm_selector.py   — ALL LLM calls go through get_llm()
agent/tools/            — Custom tools layered on top of Deep Agents:
                          human_gate.py (interrupt), communicate.py, store_result.py
mcp_clients/registry.py — Reads Skills.md [mcp_servers], builds MCP tool list
mcp_server/server.py    — Inbound MCP server (FastMCP)

## Deep Agents SDK key concepts
- create_deep_agent() returns a LangGraph CompiledGraph
- Planning is built-in via write_todos tool (no custom plan node needed)
- File I/O is built-in via read_file/write_file/edit_file/ls tools
- Sub-agents are built-in via the task tool
- Add domain tools via tools= parameter (LangChain BaseTools or MCP tools)
- Set model= via get_llm() to respect PRIVACY_MODE
- system_prompt= contains Strategy.md + Personality.md only (Skills.md is parsed for config, not injected)

## Adding a new capability
Option A (preferred): expose a new tool on an MCP server,
  add its URL to config/Skills.md [mcp_servers].
  Tool is auto-discovered at startup. Zero code changes.

Option B: write a LangChain @tool function in agent/tools/
  and add it to the custom_tools list in agent/graph.py.

## Human gate
Uses LangGraph interrupt(). The agent calls request_human_approval().
Execution pauses. Resume via: POST /mcp (submit_human_response tool).
In standalone mode: CLI prompts for approval interactively.

## LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://eu.api.smith.langchain.com
Every LangGraph step, LLM call, and tool invocation is traced automatically.

## Privacy mode
PRIVACY_MODE=true routes ALL LLM calls to local Ollama.
No data leaves the machine.
Start with: docker compose -f docker-compose.standalone.yml --profile privacy up

## Testing
pytest tests/ -v
Mock MCP tools via conftest.py MockMCPClient.
Mock LLM via pytest-mock (never make real API calls in tests).
Deep Agents graph is testable with graph.invoke({messages: [...]}).
```

### 6.2 config-api/CLAUDE.md (new)

```
# config-api — CLAUDE.md

## What this is
Small FastAPI service that serves and saves employee config files
(Strategy.md, Skills.md, Personality.md, templates/*.json).
Mounts the same ./employees/ directory as the employee containers.

## Key files
config_api/main.py       — FastAPI app
config_api/routes.py     — CRUD endpoints for config files
config_api/reload.py     — SIGHUP sender to employee containers
config_api/git.py        — Optional git commit on save

## Endpoints
GET  /config/:id/files                  — list files
GET  /config/:id/file/:name             — read file content
PUT  /config/:id/file/:name             — save file (+ optional reload)
POST /config/:id/reload                 — send SIGHUP to employee container
GET  /config/:id/validate               — check MCP server connectivity
CRUD /config/:id/template/:name         — template CRUD

## Config volume layout
/employees/<employee_id>/config/
  Strategy.md
  Skills.md
  Personality.md
  templates/
    monthly_report.json
    campaign_brief.json
  artefacts/              # written by Deep Agents FS backend

## Docker socket
The container mounts /var/run/docker.sock to send SIGHUP.
In production, replace with Redis pub/sub or a sidecar reload agent
to avoid granting Docker socket access.

## Git integration
Set GIT_ENABLED=true. Requires git to be initialised in /employees/.
Each save commits with message: 'Update <filename> for <employee_id>'.
```

## 7. Development Phases — v2.1 Update

Phase 1 is updated to use Deep Agents SDK instead of a custom StateGraph. The Config Editor is added to Phase 3 alongside the frontend. All other phase content from v2 is unchanged.

### Phase 1 — Standalone Employee (updated)

> **Change from v2** — Replace the custom 8-node StateGraph implementation with create_deep_agent(). Phase 1 now delivers a working agent with built-in planning, file I/O, and sub-agents, with only three custom tools on top.

- Hybrid Router MCP server: unchanged — build and containerise from existing code.
- employee-agent: Dockerfile, directory structure, requirements.txt with deepagents + langchain-mcp-adapters.
- agent/llm_selector.py: multi-LLM factory with PRIVACY_MODE support (unchanged).
- mcp_clients/registry.py: parse Skills.md [mcp_servers], call build_mcp_tools(), verify connectivity.
- agent/graph.py: implement build_agent() using create_deep_agent() with Hybrid Router MCP tools.
- agent/tools/communicate.py and store_result.py as custom LangChain @tool functions.
- agent/tools/human_gate.py: LangGraph interrupt() wrapper.
- mcp_server/server.py: FastMCP inbound server exposing execute_task, get_status, get_result, submit_human_response.
- LangSmith tracing: verify all nodes appear in EU endpoint project.
- docker-compose.standalone.yml with employee + hybrid-router.
- standalone/cli.py: run-task, chat, test-tool commands.
- Unit tests: mock MCP client, mock LLM, test that create_deep_agent produces correct tool list.
### Phase 3 — Task Manager & Platform (addition)

> **Addition to v2** — Config API service and web editor are built in this phase, alongside the Task Board and employee setup wizard.

- Config API (config-api/): FastAPI service, file read/write, SIGHUP reload, validate endpoint.
- Config volume layout established in ./employees/ directory.
- Frontend Config Editor page (/employees/:id/config): Monaco Editor tabs for Strategy, Skills, Personality.
- Frontend Template Editor: visual JSON Schema builder + raw editor + Ajv validation.
- Git integration (optional): GIT_ENABLED flag, commit on save, history view.
- config-api added to docker-compose.yml and docker-compose.standalone.yml.
End of Document  —  Brage AI Hub Specification v2.1

