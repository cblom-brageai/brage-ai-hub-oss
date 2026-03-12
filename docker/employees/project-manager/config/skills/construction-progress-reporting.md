# Construction Progress Reporting

Produce Checkpoint Reports and Stage Reports reflecting actual site progress against the project plan.

## Outputs
- Checkpoint Report (weekly) — stored via `store_result`
- Stage Report (end of each PRINCE2 stage) — stored via `store_result`

## Checkpoint Report Structure
- Report date and reporting period
- Project name and current stage
- RAG status: 🟢 On Track / 🟡 At Risk / 🔴 Exception
- Work completed this period (by work package)
- Work planned next period
- Schedule status: milestones due, milestones achieved, any slippage
- Budget status: spend to date vs plan
- Open risks (count and top items)
- Open issues (count and top items)
- Open NCRs / punch list items
- Contractor resource on site (headcount, key plant)
- HSE summary (near misses, incidents, permit-to-work compliance)
- Photos or site observations (summarised if provided)

## Stage Report Structure
- Stage name and dates (planned vs actual)
- Summary of products delivered and acceptance status
- Schedule variance (days)
- Cost variance (NOK / %)
- Quality summary (NCRs raised, closed, outstanding)
- Risk summary (risks raised, closed, carried forward)
- Issue summary
- Lessons learned this stage
- Recommendation for next stage authorisation

## Construction phase milestones to track
Civil: access road complete, all foundations complete (driven piles / ground screws), cable duct installation complete, inverter station pad complete
Structural: first row assembled, structural steelwork complete, all modules installed
Electrical: DC string installation complete, AC collection complete, MV switchgear energised, BESS integration complete
Commissioning: pre-energisation checks passed, inverter commissioning complete, BESS commissioning complete, grid compliance test passed, PAC (Provisional Acceptance Certificate) issued

## Guidelines
- Compare actuals against the baseline plan in the PID — do not revise the baseline without Project Board approval
- State variances in absolute terms (days, NOK) not just percentages
- Always call `store_result` as the final step
