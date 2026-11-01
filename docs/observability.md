# Observability: tracing, usage and conversation state

## LangSmith tracing

Tracing is off by default. Turn it on with:

```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com     # or https://eu.api.smith.langchain.com
LANGCHAIN_PROJECT=brage-ai-hub
```

All Python services read these variables; LangChain exports every model, tool and graph run automatically. Nothing in the code imports the LangSmith SDK directly, so switching the sink later (OpenTelemetry, Langfuse) is a configuration change.

## Run tags and metadata

Runs are attributed consistently so you can filter and aggregate:

| Where | run_name | tags | metadata |
|---|---|---|---|
| Employee agent (`mcp_server/server.py`) | `<employee>-<thread prefix>` | `[employee_id]` | `employee_id`, `thread_id` |
| Meeting agents (`agent/tracing.py`) | `<agent>:<step>` e.g. `qa-agent:answer` | `[agent_id, "meeting-agent"]` | `agent_id`, `meeting_id`, `step` |
| LLM gateway (`config-api /llm/generate`) | caller-supplied, e.g. `onboarding-chat` | `["config-api", role]` | `source`, plus caller metadata |
| Slack intent classification | `slack-task-intent` | `["config-api", "slack"]` | |

Keep these when adding model calls; the admin page depends on `metadata.employee_id`.

## The admin usage page

`apps/frontend/src/app/api/admin/usage/route.ts` queries the LangSmith REST API (`POST /api/v1/runs/query`) for root chain runs in the configured project over the last N days and aggregates runs, tokens and cost by `metadata.employee_id` and by day. Known limits:

- At most 1,000 runs per query; there is no pagination yet.
- Root chain runs do not carry the model name, so the per-model breakdown often shows `unknown`.
- Meeting-agent runs appear under employee `unknown` (they are grouped by `meeting_id` instead).
- Without `LANGCHAIN_API_KEY` the page shows zeros. A LangSmith-free usage ledger is on the roadmap.

## Conversation state

Employee agents run on LangGraph threads with an in-memory checkpointer (`MemorySaver`, created in `agent/graph.py::build_checkpointer`). Reusing a `thread_id` across `/chat` or `/task` calls keeps the conversation; the human approval gate (`interrupt()`) pauses the thread until `POST /resume/{employee_id}` answers it. Threads are lost when the container restarts. A durable Postgres checkpointer (`langgraph-checkpoint-postgres` against the Supabase database) is the planned follow-up; see the roadmap.

## Logs

Each service logs to stdout: `cd docker && make logs`, or `docker logs -f employee-<id>`. Set `LANGCHAIN_TRACING_V2=true` for the full picture of a run, including tool inputs and outputs.
