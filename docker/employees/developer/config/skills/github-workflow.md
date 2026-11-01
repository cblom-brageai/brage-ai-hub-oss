# GitHub Workflow

Manage code on GitHub: create branches, commit files, open pull requests, trigger Actions, and review PRs — all via the GitHub MCP server.

## Standard branch naming
- `feat/<short-description>` — new feature
- `fix/<short-description>` — bug fix
- `deploy/<target>-<service>` — deployment config or workflow

## Commit message format
```
<type>: <imperative short summary>

- Detail line 1
- Detail line 2
```
Types: `feat`, `fix`, `ci`, `docs`, `refactor`, `chore`

## PR checklist before opening
- [ ] All secrets referenced as env vars, never hardcoded
- [ ] Dockerfile present if service is containerised
- [ ] GitHub Actions workflow added or updated
- [ ] Dry-run test passed (document result in PR description)
- [ ] Rollback procedure described in one sentence in PR body

## PR description template
```markdown
## What
<one paragraph>

## Dry-run result
API: <endpoint tested>
Status: PASS / FAIL
Response: <summary>

## Secrets required
- `SECRET_NAME` — <what it is>

## Rollback
<one sentence>
```

## GitHub Actions — key patterns
- Use `actions/checkout@v4` for all repos
- Pin third-party actions to a SHA, not a tag
- Store all credentials as GitHub Actions secrets (`${{ secrets.NAME }}`)
- Use `environment: production` gate for deploy jobs that touch live systems

## Guidelines
- Always work on a branch — never commit directly to `main`
- Open the PR immediately after the first commit so reviewers can follow along
- Squash commits before merge unless the history tells a meaningful story
- Always call `store_result` with a summary of changes and the PR link
