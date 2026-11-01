# Example skill: weekly status report

## When to use
When asked for a status update, or every Friday if a recurring task exists.

## Inputs
- Tasks completed this week (use `list_artefacts` and the task board context in the message)
- Open risks and blockers

## Procedure
1. Summarise outcomes, not activity. One line per deliverable.
2. List risks with an owner and a proposed mitigation.
3. End with the plan for next week.

## Output
A Markdown document of at most one page, saved with `store_result` under `status-report-<date>.md`.
