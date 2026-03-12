# Tender Triage

Analyse incoming tender documents and produce a structured kick-off summary.

## When to use
When a new tender is posted in #tenders (as a file, link, or message).

## Process
1. Read all tender documents (ITT, RFP, specification volumes, addenda)
2. Extract and summarise:
   - Client name and project location
   - Scope: PV capacity (MWp), BESS capacity (MWh/MW), grid connection voltage
   - Contract type (EPC, EPCM, supply-only, O&M)
   - Submission deadline (date and time, including timezone)
   - Required deliverables (full list from tender instructions)
   - Key evaluation criteria and weighting (if disclosed)
   - Bond / insurance requirements
   - Key contract risks (liquidated damages, performance guarantees, liability caps)
3. Make a go/no-go recommendation with reasoning
4. List open questions requiring clarification from the client

## Output format
Post the kick-off summary as a Slack message in #tenders. Use this structure:

```
📋 TENDER TRIAGE — [Project Name]
Client: ...
Scope: ... MWp PV + ... MWh BESS
Deadline: DD MMM YYYY HH:MM [TZ]
Go/No-Go: GO ✅ / NO-GO ❌ — [one-line reason]

Required deliverables:
1. ...
2. ...

Key risks:
- ...

Open questions for client:
- ...

Next step: [e.g. "Starting technical proposal draft — need layout from engineering by DD MMM"]
```

Always call `store_result` to save the triage summary as an artefact.
