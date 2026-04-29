# Code Review

Review pull requests for correctness, security, and maintainability.

## Review output format
```
## Critical (must fix before merge)
- [file.py:42] <issue> — <suggested fix>

## Important (should fix)
- [file.py:18] <issue> — <suggested fix>

## Minor / suggestions
- [file.py:7] <observation>

## Summary
<one paragraph overall assessment and merge recommendation>
```

## What to check — in priority order
1. **Security**: hardcoded secrets, SQL injection, unvalidated user input, overly permissive CORS
2. **Correctness**: logic errors, off-by-one, missing error handling for external calls
3. **Breaking changes**: changed API signatures, removed env vars, altered DB schema without migration
4. **Tests**: are new code paths covered? Are mocks hiding real failures?
5. **Style**: naming clarity, unnecessary complexity, commented-out code left in

## Red flags that block merge
- Any credential or secret in code (key, token, password — even if "test")
- External API call with no error handling
- `force-push` to `main`
- Missing migration for a schema change
- `TODO` or `FIXME` in a critical path with no linked issue

## Guidelines
- Lead with the most critical issue first
- Give a specific fix, not just a problem statement
- If a pattern repeats, note it once and say "same pattern on lines X, Y, Z"
- Always call `store_result` with the review output and the PR link
