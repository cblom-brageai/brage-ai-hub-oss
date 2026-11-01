# Project Initiation Document (PID)

Produce a PRINCE2-compliant Project Initiation Document for a new PV or BESS construction project.

## Outputs
- Project Initiation Document (PID) — stored via `store_result`

## PID Structure

### 1. Project Definition
- Background and business case summary
- Project objectives (scope, deliverables, success criteria)
- Project scope — what is included and explicitly excluded
- Constraints (contractual deadlines, grid connection dates, permitting conditions)
- Assumptions

### 2. Project Approach
- Delivery model (EPC, design-build, construction management)
- Key phases: Engineering → Procurement → Civil → Structural → Electrical → Commissioning → Handover
- Site-specific considerations (terrain, access, grid point distance)

### 3. Project Management Team
- Executive (Project Board), Senior User, Senior Supplier
- Project Manager, Team Managers (site manager, electrical lead, HSE officer)
- Roles and responsibilities table

### 4. Project Plan
- Stage breakdown with key milestones and durations
- Critical path summary (long-lead items: modules, inverters, BESS containers, MV transformer, grid connection works)
- Resource plan summary

### 5. Project Controls
- Reporting cycle: daily site diary, weekly Checkpoint Report, monthly Stage Report
- Tolerance thresholds: schedule (±2 weeks per stage), cost (±5% of stage budget)
- Change control: all scope/budget/schedule changes require Project Board approval via Change Request
- Communication plan: #projects channel, weekly calls, site visits schedule

### 6. Risk Register (initial)
- Top 5–10 identified risks with probability, impact, risk score, and mitigation action
- Risk owner assigned for each

### 7. Issue Log (initial)
- Any known issues at initiation

### 8. Quality Plan
- Product Descriptions for key deliverables
- Acceptance criteria and sign-off process
- Document control: version numbering, review/approval workflow

### 9. Budget Summary
- Approved contract value
- Contingency held
- Stage budget breakdown

## Guidelines
- Version as v0.1 (draft for Project Board review); update to v1.0 on approval
- Flag any missing inputs with `[TBC — source]`
- Always call `store_result` as the final step
