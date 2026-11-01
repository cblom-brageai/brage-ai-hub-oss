# Roadmap

What we know is missing or planned. Pick something and open an issue before starting large work.

## Platform

- **Durable conversation state.** Replace the in-memory checkpointer with `langgraph-checkpoint-postgres` on the Supabase database so threads and pending approvals survive restarts.
- **Authentication and row level security.** Add Supabase Auth to the frontend, enable RLS with policies on every table, and authenticate calls between services (see SECURITY.md).
- **Usage ledger without LangSmith.** A LangChain callback that records tokens and cost per employee, task and meeting into an `ai_interactions` table, with the admin page reading from either source.
- **Agent pre-warming.** Build the Deep Agent on container start instead of on the first request (about 15 seconds today).
- **Knowledge pipeline.** A hybrid retrieval MCP server (RAG over artefacts and uploaded documents, structured queries over Supabase) that every employee can list under `[mcp_servers]`.
- **Slack formatting.** Block Kit output instead of plain text replies.

## Meeting Hub

- **Pluggable speech-to-text.** An interface behind the Soniox client so AssemblyAI, Deepgram or a local Whisper server can be used, which would also close the privacy gap for meetings.
- **Extension options page.** Set the hub URL at runtime with an optional host permission instead of baking it into the build.
- **More meeting agents.** A CRM update agent, a PRINCE2 project agent and a configurable "swarm" view (retrieval method, meeting contexts, Pre-Meeting / Live / Review / Finalized states) from an earlier prototype.
- **Chrome Web Store listing.**

## Modules ported from earlier versions

- **Privacy mode, completed.** Per-employee privacy flag, Ollama model discovery and a provider selector in the UI, local embeddings once the knowledge pipeline exists.
- **Voice interview.** A voice agent (ElevenLabs Conversational AI or Web Speech API) that interviews the user section by section and fills a template-driven document through client tools.

## Done recently

- Documentation Hub: Template Studio (sections and typed fields, JSON view, live preview, model-generated templates) and the form-based document writer that saves artefacts with their form data.
- Multi-turn conversations with thread ids and a working human approval gate (chat and Slack).
- Single LLM gateway for all non-agent model calls; provider-agnostic selector in every service.
- Per-meeting run tags for tracing; tracing opt-in by default.
- Pinned Python dependencies and per-app CI.
