# Employees

A virtual employee is a container built from `apps/employee-agent` plus a configuration folder. The folder is everything that makes one employee different from another.

## Configuration folder

```
docker/employees/<employee-id>/config/
├── Strategy.md        role, goals (6-month horizon), deliverables, decision authority
├── Personality.md     tone, values, communication style
├── agent.config.md    machine-readable settings (see below)
├── skills/            one Markdown file per capability, loaded natively by Deep Agents
│   ├── content-creation.md
│   └── ...
└── artefacts/         scratch space for the agent's virtual filesystem (ignored by git)
```

`Strategy.md` and `Personality.md` are injected into the system prompt. Skills are passed to Deep Agents, which reads them on demand. `agent.config.md` is never shown to the model; it is parsed for these INI blocks:

```ini
[mcp_servers]
github = http://github-mcp:8082/mcp        # any MCP server; its tools become agent tools

[llm_overrides]
reason = gemini-3.1-pro-preview            # model used to build the agent (planning loop)
write  = gemini-3-flash-preview            # reserved for fast writing tasks

[human_gate]
require_approval_for = publish_external, send_email
```

Model ids follow the rules in [privacy-mode.md](privacy-mode.md): `gemini-*`, `claude-*`, `gpt-*`/`o*`, `ollama/<model>`. Leave `[llm_overrides]` out to inherit `DEFAULT_LLM` / `REASONING_LLM` from the environment.

## What an employee can do

Built-in tools, all in `apps/employee-agent/agent/tools/`:

| Tool | Purpose |
|---|---|
| `store_result` | Save a finished deliverable to the Supabase `artefacts` table. Agents are instructed to use this, not `write_file`, for deliverables. |
| `list_artefacts`, `read_artefact` | Find and reread earlier work. |
| `create_task` | Add a task to the shared backlog, optionally with a cron recurrence. |
| `send_message` | Post to a Slack channel (not needed when replying in a thread; the router posts the reply). |
| `request_human_approval` | Pause and ask a human. The chat panel shows Approve / Reject; in Slack, reply `approve` or `reject` in the thread. |

Deep Agents adds planning (`write_todos`), a sandboxed virtual filesystem rooted at the config folder, and sub-agents.

## Conversations and memory

Every call to an employee runs on a LangGraph thread. The chat panel keeps one thread until you press the reset button; Slack uses one thread per Slack thread; delegated and scheduled tasks use `task-<id>`. The checkpointer is in-memory, so threads are forgotten when the container restarts.

## Adding an employee

1. Copy [docs/employee-template](employee-template/) (or an existing employee) to `docker/employees/<employee-id>/config/` and edit the files. The onboarding assistant in the hub (Employees → New) drafts all of them from a conversation and saves them for you.
2. Add a service in `docker/docker-compose.local.yml`: copy an employee block, change `container_name`, the port, the mounted folder, `EMPLOYEE_ID` and `SLACK_DEFAULT_CHANNEL`.
3. Add `<EMPLOYEE_ID>_URL` to the `x-employee-urls` anchor and, if you use Slack, a channel in `SLACK_CHANNEL_ROUTING` on config-api.
4. `cd docker && make up`. The frontend lists every folder under `docker/employees/`.

Changing `Strategy.md`, `Personality.md` or a skill in the UI saves the file through config-api and sends SIGHUP to the container, which clears its config cache; the next request rebuilds the agent. Editing files on disk works too, followed by `docker kill --signal SIGHUP employee-<id>` or a restart.

## Slack

One bot serves all employees (Socket Mode, so no public URL). Set `SLACK_BOT_TOKEN` (`xoxb-`) and `SLACK_APP_TOKEN` (`xapp-`), subscribe the app to `message.channels` and `message.im`, invite the bot to each channel, and map channels to employees in `SLACK_CHANNEL_ROUTING`. Messages in `SLACK_BACKLOG_CHANNELS` become unassigned tasks; messages in employee channels are classified as either a task or a question. Uploaded PDFs are text-extracted and included in the message.

## The example employees

The six employees under `docker/employees/` are the ones Brage AI runs for its renewable-energy business: marketing manager, bid manager, project manager (PRINCE2), quality manager (ISO 9001/14001/45001), O&M engineer (PV and BESS) and developer (MCP servers, CI/CD, field devices over Tailscale). They are realistic examples of how to write strategies and skills, not a required set. Delete the ones you do not need, including their compose blocks.
