# Security

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). You will get an acknowledgement within a few days and a fix or mitigation plan as soon as we have one. Only the `main` branch receives fixes.

## Security model

Brage AI Hub is designed to run on a private network you control, for people you trust. Read this section before exposing any part of it to the internet.

**No authentication between services.** The employee agents (`/chat`, `/task`, `/resume`), config-api and meeting-agent accept requests from anyone who can reach them. The Next.js API routes that front them are unauthenticated too. Keep the stack behind a VPN, a reverse proxy with authentication, or Cloud Run with IAM (the provided workflow deploys with `--no-allow-unauthenticated`).

**Supabase access uses the anon key and row level security is not configured.** The hub and the Chrome extension talk to Supabase with the anon key, migration `004_templates.sql` explicitly disables row level security on `document_templates`, and no policies are defined for the other tables. Treat the Supabase project as private to the hub: do not reuse it for other applications, and do not hand the anon key to untrusted users. Enabling RLS with policies for an authenticated frontend is on the roadmap.

**config-api controls the Docker daemon.** `docker-compose.local.yml` mounts `/var/run/docker.sock` into config-api so it can send SIGHUP to employee containers for live config reload. Anyone who can call config-api can therefore control every container on the host. Remove the mount if you do not need live reload (a container restart picks up config changes), and never expose config-api beyond the host.

**The Soniox key is handed to the extension.** `GET /api/meetings/soniox-config` returns the transcription API key to the side panel so it can stream audio directly. Anyone who can reach the hub can read that key. Restrict the hub's network exposure, and use a Soniox key with a spending limit.

**Employees have the tools you give them.** MCP servers listed in `agent.config.md` and tokens such as `GITHUB_TOKEN` give the agent real-world capabilities. Scope tokens narrowly, keep `[human_gate]` rules for irreversible actions, and review the publishers' channel configuration before enabling them.

**Prompt injection.** Meeting transcripts, Slack messages, uploaded files and artefacts are all untrusted input that reaches the agents. The human gate and narrow tool scopes are the mitigations; there is no content filtering.

**Transcription and models are external services unless you choose otherwise.** With a hosted LLM provider, prompts leave your network. `PRIVACY_MODE=true` keeps model calls local, but Soniox transcription and a hosted Supabase remain external; see docs/privacy-mode.md.

## Secrets

Configuration is read from `.env`, which is ignored by git. `.env.example` contains placeholders only. If you believe a secret was committed, rotate it first and then open a private report.
