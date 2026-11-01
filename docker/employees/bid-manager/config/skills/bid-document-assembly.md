# Bid Document Assembly

Compile all completed sections into a final bid package and prepare the submission checklist.

## When to use
When all individual bid sections have been drafted, reviewed, and stored — typically 24–48 hours before submission deadline.

## Process
1. Retrieve all artefacts created during the bid (via `store_result` IDs or by listing stored artefacts)
2. Verify each required deliverable is present and complete:
   - No sections marked `[PENDING]`
   - Compliance matrix shows no unresolved NON-COMPLIANT items
   - All pricing/commercial items have received human approval
3. Produce a **Bid Package Index** listing every document, its version, page count, and file name
4. Produce a **Submission Checklist** confirming:
   - All mandatory enclosures are present
   - Submission format matches tender instructions (PDF, portal upload, hard copy requirements)
   - Signatures / company stamp requirements are flagged for human action
   - Submission deadline confirmed
5. Post the Bid Package Index and Submission Checklist in #tenders and tag the responsible human approver

## Output format — Bid Package Index

```markdown
# Bid Package Index — [Project Name]
Prepared: DD MMM YYYY
Version: 1.0 (for review) / 2.0 (final)

| # | Document | File name | Status |
|---|---|---|---|
| 1 | Cover Letter | cover_letter_v1.pdf | ✅ Complete |
| 2 | Technical Proposal | technical_proposal_v2.md | ✅ Complete |
| 3 | Project Execution Plan | pep_v1.md | ✅ Complete |
| 4 | Compliance Matrix | compliance_matrix_v1.md | ✅ Complete |
| 5 | Commercial Proposal | commercial_proposal_v1.pdf | ⏳ Awaiting human approval |
| 6 | Company Profile & References | company_profile.pdf | ✅ Complete |

SUBMISSION CHECKLIST
[ ] All documents exported to PDF
[ ] Uploaded to [tender portal / emailed to address]
[ ] Received confirmation of receipt
[ ] Deadline: DD MMM YYYY HH:MM [TZ]
```

Always call `store_result` to save the Bid Package Index.
Post the index in #tenders with a request for final human sign-off.
