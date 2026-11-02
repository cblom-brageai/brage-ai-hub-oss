# Contributing

Thanks for helping improve Brage AI Hub. Bug reports, documentation fixes and new modules are all welcome.

## Before you start

- Check [docs/ROADMAP.md](docs/ROADMAP.md) and the open issues; larger changes are easier to land when there is an issue to discuss the approach first.
- Read [CLAUDE.md](CLAUDE.md). It lists the conventions every change must follow (single LLM door, threads, tracing tags, no secrets).

## Development setup

There is no root install. Each app is set up on its own.

```bash
# Python apps
cd apps/employee-agent            # or config-api, meeting-agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check . && pytest -q

# Frontend
cd apps/frontend && pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Chrome extension
cd apps/chrome-extension && pnpm install --frozen-lockfile
pnpm typecheck && pnpm build
```

Running the whole stack needs a Supabase project and an LLM key or Ollama; see the README quick start. For most backend changes the unit tests are enough: they use fake models and a fake LangGraph graph.

## Updating dependencies

Python dependencies are declared in `requirements.in` and pinned in `requirements.txt` with [uv](https://docs.astral.sh/uv/):

```bash
cd apps/<app>
uv pip compile requirements.in -o requirements.txt --universal --python-version 3.11
```

Commit `requirements.in` and `requirements.txt`. `requirements-dev.txt` holds the test and lint tools as version ranges on purpose: the runtime lock is the single source of pins and pip resolves both files together. Node dependencies use `pnpm`; commit the updated `pnpm-lock.yaml`.

## Pull requests

- Branch from `main`, keep the change focused, and fill in the pull request template.
- CI must pass: lint, typecheck, unit tests and build for the frontend, typecheck and build for the extension; `ruff` and `pytest` for the Python apps.
- Do not commit `.env`, credentials, project identifiers or customer data. The example employees and prompts must stay publishable.
- Update the docs that describe the behaviour you changed (README, `docs/`, `CLAUDE.md`).
- Commit messages follow the existing style: `feat:`, `fix:`, `docs:`, `chore:` prefixes with a short imperative summary.

## Adding a module

The roadmap lists modules that are ported from earlier internal versions (documentation hub, voice interview, usage ledger). Each should land as its own pull request, behind a feature flag or an optional service where that is practical, with a doc page under `docs/`.

## Licensing

By contributing you agree that your contributions are licensed under the Apache License 2.0, the same license as the project.
