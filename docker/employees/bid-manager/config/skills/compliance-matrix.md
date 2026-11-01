# Compliance Matrix

Generate a compliance matrix mapping every tender requirement to the corresponding section of the bid response.

## When to use
For every tender response, as the final quality-check step before assembling the bid package.

## Process
1. Read the tender's list of requirements, evaluation criteria, and mandatory submission items
2. For each requirement, identify:
   - The requirement reference (clause, section, or item number from the tender)
   - The requirement text (abbreviated)
   - Compliance status: COMPLIANT / PARTIAL / NON-COMPLIANT / NOTE
   - Where addressed in the bid response (document name + section number)
   - Any caveats or conditions
3. Flag any NON-COMPLIANT or PARTIAL items prominently — these must be reviewed before submission

## Output format (Markdown table)

```markdown
| Req. Ref | Requirement | Status | Addressed in | Notes |
|---|---|---|---|---|
| 3.1 | EPC contractor licence | COMPLIANT | Company Profile §2 | Copy of licence attached |
| 4.2.1 | Minimum 5 MW PV references | COMPLIANT | References §4, Annex B | 3 projects listed |
| 5.3 | Performance bond 10% | COMPLIANT | Commercial Proposal §6 | Subject to final approval |
| 6.1 | BESS fire suppression to FM approved standard | PARTIAL | Technical Proposal §8.4 | Awaiting supplier confirmation |
| 7.2 | Local content ≥30% | NOTE | — | Not defined — flagged for legal review |
```

## Guidelines
- Every row in the tender's compliance checklist (if provided) must appear in the matrix
- Do not skip requirements — mark NON-COMPLIANT rather than omit
- Always call `store_result` to save the compliance matrix as an artefact
