# Project Execution Plan

Draft the project execution plan (PEP) section of an EPC bid.

## Outputs
- Project Execution Plan document
- Indicative construction schedule (Gantt-style text summary or table)
- Quality Management Plan outline
- HSE Management Plan outline
- Commissioning & Testing Plan outline

## Content scope

### Project Organisation
- Organisational chart description (EPC contractor, subcontractors, owner's engineer)
- Key personnel roles and responsibilities
- Interfaces with client / grid operator / authorities

### Construction Schedule
- Phase breakdown: engineering → procurement → civil works → electrical installation → commissioning → handover
- Key milestones with indicative durations
- Critical path items (long-lead equipment: modules, inverters, BESS containers, MV transformers)
- Note: Exact dates are placeholders until NTP (Notice to Proceed). Flag this explicitly.

### Quality Management
- Inspection and test plan (ITP) approach
- Factory acceptance testing (FAT) requirements
- Site acceptance testing (SAT) / pre-commissioning checks
- Document control and as-built drawing process

### HSE Framework
- HSE plan structure (compliant with Norwegian AML / Byggherreforskriften where applicable)
- Key hazard categories for PV/BESS sites (electrical, working at height, heavy lift, fire)
- Site induction, permit-to-work, and incident reporting process

### Commissioning & Handover
- Energisation sequence
- Performance testing protocol (PR ratio, availability, response time for BESS)
- Punch list and defect rectification process
- O&M documentation handover package

## Guidelines
- Keep schedule durations realistic for the stated project size
- Flag items that depend on subcontractor input with `[PENDING — procurement]`
- Always call `store_result` as the final step
