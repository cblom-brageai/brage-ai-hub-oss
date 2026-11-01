# Debugging

Diagnose and fix bugs in Python (FastAPI, LangGraph) and TypeScript (Next.js) services.

## Debugging process
1. **Reproduce**: get the exact error message, stack trace, and request that triggered it
2. **Isolate**: identify the smallest code path that produces the error
3. **Hypothesise**: form one hypothesis about root cause before reading more code
4. **Verify**: confirm or refute with a log line, curl, or unit test
5. **Fix**: minimal change — do not refactor while fixing
6. **Confirm**: reproduce the original error, verify it is gone

## Common patterns in this codebase

### LangGraph / Deep Agents agent errors
- Cold start errors: agent fails on first request — check if `build_agent()` completed (look for `Agent ready` log)
- MCP server timeout: MCP server not reachable — check container is running and URL in `agent.config.md` is correct
- `/proc` path errors: `virtual_mode=True` blocks writes outside `/app/config`; LLM tried to write to system path

### FastAPI errors
- `422 Unprocessable Entity`: request body does not match Pydantic model — log `request.body()` to see raw payload
- `500` with no traceback: exception swallowed somewhere — add `logger.exception()` in the route handler

### Next.js / React errors
- Hydration mismatch: server-rendered HTML differs from client render — check for `Date.now()`, `Math.random()`, or browser-only APIs in render path
- `useEffect` fetch not running: check for React strict mode double-invoke, or that the dependency array is correct

## Useful diagnostic commands
```bash
# Tail a container log
docker logs <container> -f --tail=50

# Exec into container
docker exec -it <container> bash

# Test an internal service endpoint
curl -s http://localhost:<port>/health | jq

# Check env vars in container
docker exec <container> env | grep -i key
```

## Guidelines
- Always read the full stack trace — the root cause is rarely the last line
- Check logs BEFORE adding print statements — the error is usually already there
- Fix only what is broken; leave surrounding code unchanged
- Always call `store_result` with a bug report: root cause, fix applied, and how to verify
