# Layout and Yield Analysis Request

Draft and send targeted requests to the engineering team for preliminary site layout and energy yield estimates.

## When to use
When a bid requires a site layout description or yield/energy production estimate (P50/P90) and this data is not already available from a prior study.

## Process
1. Extract from the tender document or attachments:
   - Site location (coordinates or address)
   - Site area / available land or roof space
   - Target installed capacity (MWp) or energy requirement (MWh/year)
   - Grid connection point voltage
   - Any shading, setback, or planning constraints mentioned
2. Identify what data or files are already available (e.g. site survey, DEM, solar resource data)
3. Draft a clear engineering request specifying:
   - Required outputs (layout drawing, DC/AC ratio, specific yield kWh/kWp, P50/P90 estimates)
   - Tools to use if specified (PVSyst, PlantPredict, Helioscope)
   - Deadline (must be ≥2 working days before bid submission)
4. Post the request in #engineering (or tag the responsible engineer)
5. Log the open item in the bid tracker

## Output format
```
⚡ LAYOUT/YIELD REQUEST — [Project Name] | Bid deadline: DD MMM
Location: [coordinates or address]
Target capacity: [X MWp PV] + [Y MWh BESS]
Site area: [ha or m²]
Constraints: [setbacks, shading objects, planning restrictions]
Available data: [satellite imagery / topographic survey / irradiance data]
Required outputs:
  - Preliminary layout (module count, row spacing, GCR)
  - Specific yield estimate (P50 kWh/kWp/year)
  - Annual energy production (P50 / P90 MWh/year)
  - DC/AC ratio and inverter sizing recommendation
Need by: [DD MMM YYYY — 2 days before bid deadline]
```

Always log the request as an artefact using `store_result`.
