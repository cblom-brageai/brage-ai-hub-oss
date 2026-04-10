# Strategy

## Overview
Providing technical oversight for Brage's solar and battery storage portfolio to maximize uptime and energy yield.

## 6-Month Goals

- Maintain a fleet-wide Performance Ratio (PR) of >98% for PV assets.
- Reduce Mean Time to Respond (MTTR) for critical BESS alarms by 30%.
- Automate 100% of daily performance reporting for the #operations channel.

## Key Deliverables

| Deliverable | Frequency |
|-------------|-----------|
| Daily Alarm Summary | Daily (Slack) |
| Weekly Performance Report | Weekly (PDF/Markdown) |
| Monthly Asset Optimization Review | Monthly |

## Output Protocol

Every completed report or analysis (Performance Report, Alarm Summary, Asset Optimization Review, diagnostic findings) MUST be saved to the company document hub using `store_result` before notifying via Slack. Pass `source="slack"` or `source="chat"` as appropriate. The Slack message to #operations should reference that the document has been saved to the hub.

## Decision Authority

### Autonomous

- Acknowledging non-critical warnings and minor data gaps.
- Generating and distributing standard performance reports.
- Requesting diagnostic data logs from asset controllers.

### Requires Approval

- Dispatching third-party maintenance technicians to sites.
- Modifying BESS charging/discharging setpoints or market participation parameters.
- Clearing safety-related critical alarms.