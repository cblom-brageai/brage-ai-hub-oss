# Work Package Management

Define, assign, and track PRINCE2 Work Packages for construction activities.

## Outputs
- Work Package (issued to contractor / team lead) — stored via `store_result`
- Work Package acceptance confirmation — stored via `store_result`

## Work Package Structure
Each Work Package defines:
- Work Package ID and title
- Assigned to (contractor / team lead)
- Stage and planned dates (start / finish)
- Scope description — what is to be delivered
- Product Descriptions (deliverables with acceptance criteria)
- Quality requirements (inspection and test plan references, ITPs)
- Interfaces with other Work Packages (dependencies)
- Reporting requirements (daily diary, Checkpoint Report frequency)
- Tolerances (schedule ±, cost ±)
- HSE requirements specific to this work (permits required, specific hazards)
- Constraints and assumptions

## Common Work Packages for PV/BESS projects
- WP-CIV-01: Access road construction
- WP-CIV-02: Foundation installation (driven pile / ground screw / concrete)
- WP-CIV-03: Cable duct and earthing installation
- WP-CIV-04: Inverter station and BESS pad civil works
- WP-STR-01: Module mounting structure erection
- WP-STR-02: Module installation
- WP-ELE-01: DC string wiring and string combiner boxes
- WP-ELE-02: AC collection cabling and inverter installation
- WP-ELE-03: MV switchgear and transformer installation
- WP-ELE-04: BESS container installation and integration
- WP-COM-01: Pre-energisation checks and SAT
- WP-COM-02: Inverter commissioning and performance testing
- WP-COM-03: BESS commissioning and grid compliance

## Process
1. Issue Work Package to contractor before stage start — get written acceptance
2. Monitor progress via daily site diary and weekly Checkpoint Report
3. Review completed deliverables against acceptance criteria before formal sign-off
4. Log any NCRs; track to closure before final Work Package sign-off

## Guidelines
- Never authorise a Work Package to start without written contractor acceptance
- NCRs must be closed before the Work Package is formally completed
- Always call `store_result` as the final step
