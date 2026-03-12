# Risk and Issue Management

Maintain and update the project risk register and issue log throughout the project lifecycle.

## Outputs
- Updated Risk Register — stored via `store_result`
- Updated Issue Log — stored via `store_result`
- Exception Report (when stage tolerances are threatened) — stored via `store_result`

## Risk Register Format
Each risk entry:
| ID | Description | Probability (H/M/L) | Impact (H/M/L) | Risk Score | Mitigation | Contingency | Owner | Status |

Risk score = Probability × Impact (H×H = Critical, H×M or M×H = High, M×M = Medium, etc.)

## Issue Log Format
Each issue entry:
| ID | Description | Date Raised | Priority (H/M/L) | Impact | Action | Owner | Target Date | Status |

## Common PV/BESS project risks to monitor
- Grid connection delay (long lead, utility-dependent)
- Module or inverter delivery delay
- BESS container delivery delay
- Ground conditions worse than design assumption (rock, groundwater)
- Permitting condition not cleared before planned civil start
- Contractor resource unavailability (key personnel, plant)
- Weather delays during civil works window
- MV cable route conflict with utilities
- BESS commissioning software / grid code compliance delay

## Process
1. Review risks at each weekly status update — update probability/impact if circumstances change
2. When a risk materialises, close it and open a corresponding Issue
3. When an issue threatens stage tolerance (schedule or cost), prepare an Exception Report for Project Board
4. Log lessons learned for any closed risk or resolved issue

## Exception Report trigger
Escalate when:
- Forecast cost overrun exceeds stage budget tolerance (±5%)
- Forecast schedule slippage exceeds stage tolerance (±2 weeks)
- A new risk is assessed as Critical (H×H) with no viable mitigation

## Guidelines
- Never suppress a risk because it is uncomfortable — log it and mitigate it
- Always call `store_result` after updating the register/log
