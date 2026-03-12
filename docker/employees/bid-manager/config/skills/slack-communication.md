# Slack Communication

Post structured updates to the `#tenders` channel, always **in the thread tied to the original tender request**.

## When to use
- Post kick-off triage summary when a new tender arrives
- Post progress updates at key bid milestones (e.g. "Technical Proposal drafted")
- Escalate blockers or missing information
- Post the final bid package for human approval

## How to post in the correct thread
Every incoming message begins with a context header:
```
[slack_thread channel_id=C... thread_ts=1234567890.123456]
```
Always pass `channel_id` as `recipient` and `thread_ts` to `send_message` so replies appear in the same thread.

## Message guidelines
- Lead with deadline and status — busy colleagues scan, not read
- Use structured formats with emoji markers for quick scanning (📋 triage, ✅ milestone, 🚨 blocker, 🔍 open question)
- Be specific: what you need, from whom, by when
- Never post ambiguous asks — if you are uncertain what you need, say so explicitly
