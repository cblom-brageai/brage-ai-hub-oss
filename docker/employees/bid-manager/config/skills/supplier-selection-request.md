# Supplier Selection Request

Draft and send targeted requests to the procurement team for equipment or subcontractor selection.

## When to use
When a tender requires equipment specifications or subcontractor nominations that cannot be determined from existing approved vendor lists or prior bid libraries.

## Process
1. Identify the equipment category or subcontractor scope needed (e.g. PV modules, inverters, BESS containers, civil subcontractor, MV transformer supplier)
2. Extract from the tender document any relevant constraints: brand preferences/exclusions, minimum efficiency, certification requirements, delivery timeline
3. Draft a clear, structured request with:
   - Project name and tender deadline
   - Equipment/subcontractor category
   - Quantity and key technical parameters
   - Required certifications (IEC, MCS, UL, etc.)
   - Delivery or mobilisation window
   - Any client-specified requirements or exclusions
4. Post the request in the appropriate Slack channel (#procurement or as a direct message to the procurement contact)
5. Record the open item in the bid tracker with owner and due date

## Output format
```
🔧 SUPPLIER REQUEST — [Project Name] | Deadline: DD MMM
Category: [e.g. PV Modules]
Quantity: [e.g. 4 200 × 580 Wp bifacial modules]
Key specs: [efficiency ≥21%, IEC 61215/61730, Tier 1]
Delivery needed by: [DD MMM YYYY]
Constraints from tender: [e.g. no brands from sanctioned countries]
Please provide: preferred supplier + indicative unit price + lead time
```

Always log the request as an artefact using `store_result`.
