# Project Closure

Execute the PRINCE2 Closing a Project process and produce all required closure documentation.

## Outputs
- Project Closure Checklist — stored via `store_result`
- End Project Report — stored via `store_result`
- Lessons Learned Report — stored via `store_result`
- Handover Certificate / PAC/FAC confirmation — stored via `store_result`

## Closure Checklist
- [ ] All Work Packages formally signed off
- [ ] All NCRs closed (or accepted via concession)
- [ ] Punch list cleared or agreed residual items documented
- [ ] Provisional Acceptance Certificate (PAC) issued by client
- [ ] Final Acceptance Certificate (FAC) date agreed
- [ ] As-built drawings issued to client
- [ ] O&M documentation package handed over (manuals, warranties, test records)
- [ ] BESS commissioning report and grid compliance certificate issued
- [ ] Performance test report issued (PR ratio, availability, BESS response)
- [ ] All contractor accounts settled (or dispute status documented)
- [ ] Defect liability period start date confirmed
- [ ] Project team resources released

## End Project Report Structure
- Project summary: scope, location, installed capacity (MWp / MWh)
- Timeline: planned vs actual start/finish per stage
- Budget: approved baseline vs final cost, variance explanation
- Quality: total NCRs raised/closed, outstanding defects
- HSE: incident summary, near misses, LTI-free confirmation
- Risk summary: risks materialised, impacts, mitigations applied
- Lessons learned highlights (top 5)
- Outstanding items (defect liability, retentions, insurance)

## Lessons Learned Report
Capture lessons under:
- Planning and estimating
- Procurement and supply chain
- Civil construction
- Electrical installation
- Commissioning
- Client and stakeholder management
- PRINCE2 process adherence

## Guidelines
- Do not close the project until PAC is signed
- Flag any outstanding items (retentions, warranties, disputes) explicitly — do not silently omit
- Always call `store_result` as the final step
