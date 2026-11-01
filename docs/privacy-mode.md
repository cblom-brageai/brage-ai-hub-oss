# Privacy mode and model selection

## Choosing models

Every model call in the hub goes through `llm_selector.get_llm()` (the same file in `apps/employee-agent/agent/`, `apps/meeting-agent/agent/` and `apps/config-api/`). The frontend never calls a provider directly; its API routes use `apps/frontend/src/lib/llm.ts`, which calls config-api's `POST /llm/generate`.

A model id is resolved in this order: an explicit override (for example `[llm_overrides]` in an employee's `agent.config.md`), then `DEFAULT_LLM` (writing) or `REASONING_LLM` (planning) from the environment, then the built-in defaults (Gemini Flash and Gemini Pro).

| Prefix | Provider | Key |
|---|---|---|
| `gemini-*` | Google Gemini | `GOOGLE_API_KEY` |
| `claude-*` | Anthropic | `ANTHROPIC_API_KEY` |
| `gpt-*`, `o1*`, `o3*`, `o4*` | OpenAI | `OPENAI_API_KEY` |
| `ollama/<model>` | Local Ollama server | none (`OLLAMA_BASE_URL`) |

You can mix providers: `DEFAULT_LLM=ollama/llama3.1:8b` with `REASONING_LLM=claude-sonnet-4-6`, or a single employee on a local model while the rest use a hosted one.

## Privacy mode

`PRIVACY_MODE=true` overrides every model id and sends all calls to the Ollama server at `OLLAMA_BASE_URL`, using `OLLAMA_MODEL` (default `llama3.1:8b`). Start the stack with the `privacy` profile so the Ollama container runs, and pull a model once:

```bash
PRIVACY_MODE=true docker compose --env-file ../.env -f docker-compose.local.yml --profile privacy up
docker exec ollama ollama pull llama3.1:8b
```

Covered: employee agents (planning, tools, sub-agents), the three meeting agents, the LLM gateway (onboarding assistant, template generation, Slack intent classification). With tracing off (the default), no prompt or completion leaves the host.

Not covered:
- **Transcription.** The Chrome extension streams meeting audio to Soniox. There is no local speech-to-text option yet (see the roadmap).
- **Supabase.** A hosted Supabase project stores artefacts, tasks and transcripts outside your network. Self-host Supabase to keep everything local.
- **MCP servers and publishers** you enable (GitHub, HubSpot, LinkedIn, Slack) talk to their own services.
- **LangSmith tracing** if you turn it on; it ships prompts and completions to LangSmith.

## Model size

Tool-heavy agent loops need a capable instruction-following model. `llama3.1:8b` is enough to try the hub; for real work with the Deep Agents planner, prefer larger models (Qwen 2.5 32B, Llama 3.3 70B or similar) and set `OLLAMA_MODEL` accordingly. Structured output (used by the meeting agents) requires a model that follows JSON schema instructions.
