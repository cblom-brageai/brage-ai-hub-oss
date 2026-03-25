---
name: solar-pr-calculator
description: >
  Use this skill whenever an O&M technician at a solar PV plant needs to calculate,
  report on, or investigate Performance Ratio (PR) according to IEC 61724 standards.
  Always invoke when the user mentions: "performance ratio", "PR calculation", "IEC 61724",
  "solar yield analysis", "final yield", "reference yield", "temperature-corrected PR",
  "PR report", "InfluxDB solar data", "TimescaleDB solar", or asks why their plant
  performance has dropped. Use this skill for monthly KPI reports, performance investigations,
  data quality audits, loss analysis, and any task involving POA irradiance + AC energy
  data from a solar plant database. Also trigger when the technician wants to query
  time-series operational data from a solar plant, apply IEC-compliant data thresholds,
  or benchmark their plant against a target PR.
---

# Solar Plant PR Calculator — IEC 61724

## 1. Gather required parameters

Before doing anything, confirm these parameters with the technician. They may already be in the conversation — extract them if so.

**Plant parameters (required):**
- `plant_capacity_kwp`: Installed DC nameplate capacity (kWp)
- `date_range`: Start and end datetime (ISO 8601, e.g. `2026-03-01` to `2026-03-31`)

**Data parameters:**
- `measurement_interval_min`: Data resolution in minutes (default: 5)
- Column/field names for: POA irradiance (W/m²), AC energy per interval (kWh), module temperature (°C, optional), ambient temperature (°C, optional)

**Thresholds (IEC 61724 — only change if the technician specifies):**
- `irradiance_threshold_wm2`: Minimum G_poa for a valid interval (default: **50 W/m²**)
- `temp_coeff_pct_per_c`: Module power temperature coefficient (default: **-0.40 %/°C**)
- `noct_c`: Nominal Operating Cell Temperature (default: **45°C**)

**Data source:**
- Type: `influxdb` | `timescaledb` | `postgresql` | `csv`
- Connection: host, port, org/database, bucket/table, token/credentials

> If the technician doesn't have all connection details handy, offer to generate a query template they can run themselves and paste the CSV back.

---

## 2. Retrieve data from the time-series database

Read `references/db_query_examples.md` for ready-to-use query templates for InfluxDB and TimescaleDB/PostgreSQL.

The goal is to export a CSV with these columns (rename as needed during query):

| Column | Unit | Required |
|--------|------|----------|
| `timestamp` | ISO 8601 datetime | Yes |
| `poa_irradiance_wm2` | W/m² | Yes |
| `ac_energy_kwh` | kWh per interval | Yes |
| `t_module_c` | °C | No (enables PR_tc) |
| `t_ambient_c` | °C | No (enables PR_tc via NOCT estimate) |

**Important data considerations:**
- If the DB stores cumulative energy (meter readings), calculate interval energy as the difference between consecutive readings.
- If AC power (kW) is stored instead of energy, multiply by the interval duration in hours to get kWh.
- Make sure timestamps are in a consistent timezone. UTC is preferred.

After retrieving or receiving data, save to a local CSV (e.g. `plant_data.csv`) to pass to the calculation script.

---

## 3. Run the PR calculation

Use the bundled script `scripts/calculate_pr.py`. It handles data quality filtering, IEC 61724 calculation, and output:

```bash
python <skill_path>/scripts/calculate_pr.py \
  --input plant_data.csv \
  --capacity <plant_capacity_kwp> \
  --output ./pr_results \
  --poa-col poa_irradiance_wm2 \
  --energy-col ac_energy_kwh \
  --t-module-col t_module_c \
  --t-ambient-col t_ambient_c \
  --temp-coeff <temp_coeff_pct_per_c> \
  --irradiance-min <irradiance_threshold_wm2> \
  --interval-min <measurement_interval_min>
```

The script applies these IEC 61724 quality filters before calculating:
1. Removes intervals where G_poa < threshold (default 50 W/m²)
2. Removes intervals with missing POA or energy data
3. Flags implausible irradiance readings (> 1400 W/m²)
4. Flags negative energy values (likely meter errors)
5. Flags intervals with specific power > 1.3 kW/kWp (implausible output)

The script saves `pr_results/pr_results.json` and `pr_results/filtered_data.csv`.

---

## 4. Formulas reference (IEC 61724-1)

**Core metrics:**
```
H_poa  = Σ(G_poa [W/m²] × Δt [h]) / 1000         [kWh/m²]  (in-plane irradiation)
Yr     = H_poa / 1.0                               [h]       (reference yield, G_STC = 1 kW/m²)
Yf     = E_AC / P_STC                              [kWh/kWp] (final yield)
PR     = Yf / Yr                                   [—]       (performance ratio)
```

**Temperature-corrected PR:**
```
T_cell  = T_amb + (NOCT - 20) / 800 × G_poa       [°C]      (if module temp not measured)
PR_tc   = Yf / Σ(G_poa × Δt/1000 × (1 + γ(T_cell - 25)))   (γ = temp coefficient)
```

**Loss yields (IEC 61724-1 §5):**
```
Capture losses (Lc) = Yr - Ya   (Ya = DC array yield, if DC data available)
System losses  (Ls) = Ya - Yf   (inverter + wiring + transformer)
Temperature losses  ≈ PR - PR_tc (expressed as fraction of PR)
```

---

## 5. Analyse the findings

After calculating, read the results from `pr_results/pr_results.json` and run the report generator:

```bash
python <skill_path>/scripts/generate_report.py \
  --results pr_results/pr_results.json \
  --target-pr <target_pr_pct_if_known> \
  --output pr_report.md
```

Then interpret the numbers. Check for and explain:

**Performance level:**
- Compare PR against industry benchmarks: >80% excellent, 75–80% good, 70–75% average, <70% investigate
- Compare against plant's own historical baseline if the technician provides it
- Compare PR vs PR_tc — a large gap (>5%) means temperature losses are significant (high-irradiance / hot climate expected; module cooling may help)

**Data quality signals:**
- **Low completeness (<90%)**: sensor dropouts, communication failures, or database gaps — escalate for investigation
- **Many "below threshold" intervals**: may be normal (seasonal low irradiance) or sensor drift (check calibration)
- **Implausible irradiance spikes**: pyranometer soiling or fault — flag for cleaning/calibration
- **Negative energy intervals**: meter rollover or communication error — verify with raw meter readings

**Performance loss indicators:**
- **PR declining over weeks/months**: progressive soiling, module degradation, or vegetation shading
- **PR drops on specific days**: inverter faults, grid curtailment, or weather events (check maintenance log)
- **PR consistently low in mornings/evenings**: horizon shading or irradiance sensor misalignment
- **High Yr but low Yf**: irradiance available but plant not producing — inverter or DC fault
- **Stable Yr, dropping Yf**: systematic production loss (soiling, degradation, partial shading)

**Recommendations format:**
For each issue found, state: what it is → probable cause → recommended action → urgency (routine / urgent / critical).

---

## 6. Output format

Present results as a structured report with these sections:

```
## PR Analysis — [Plant Name or ID] — [Period]

### Summary
| Metric        | Value           |
|--------------|-----------------|
| Period        | YYYY-MM-DD to YYYY-MM-DD |
| Capacity      | X,XXX kWp       |
| H_poa         | XXX.X kWh/m²    |
| E_AC          | XXX,XXX kWh     |
| Yf            | XX.X kWh/kWp    |
| Yr            | XX.X h          |
| PR            | XX.X%           |
| PR_tc         | XX.X% (if available) |
| Data completeness | XX.X%        |

### Data Quality
[List of quality flags and filtered interval counts]

### Loss Analysis
[Temperature losses, availability, trend observations]

### Findings & Recommendations
[Bulleted list: issue → cause → action → urgency]
```

---

## References

- `references/db_query_examples.md` — InfluxDB Flux and TimescaleDB/PostgreSQL query templates
- `references/iec_thresholds.md` — Full IEC 61724-1 parameter reference and typical threshold values
