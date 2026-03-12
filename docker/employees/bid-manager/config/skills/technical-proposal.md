# Technical Proposal Writing

Draft the technical sections of an EPC bid for PV and/or BESS projects.

## Outputs
- Technical Proposal document (full or per section)
- Equipment list with preliminary specifications
- Compliance matrix mapping tender requirements to proposal sections
- Technical clarification questions for the client

## Content scope — PV sections
- **System Overview**: project description, design basis, applicable standards (IEC, EN, NEK for Norway)
- **PV Array Design**: module technology selection rationale, string configuration, DC/AC ratio, estimated yield basis
- **Inverter & Transformer**: topology (central/string), MV transformer sizing, grid code compliance
- **Mounting Structure**: ground-mount or rooftop system type, wind/snow load basis, tracker vs fixed-tilt rationale
- **DC Cabling & Protection**: cable sizing methodology, surge protection, DC fusing/disconnection
- **AC Collection & Grid Connection**: MV collection design, POC specification, protection relay philosophy
- **SCADA & Monitoring**: data acquisition, remote monitoring, performance ratio tracking

## Content scope — BESS sections
- **BESS Overview**: use case (peak shaving, frequency response, energy arbitrage), operational strategy
- **Cell Chemistry & Topology**: LFP selection rationale, rack/container configuration, C-rate
- **Thermal Management & Safety**: HVAC/cooling system, fire suppression, cell-level protection
- **BMS & EMS**: battery management system, energy management system, grid-forming or grid-following mode
- **AC Integration**: PCS topology, harmonic compliance, power quality

## Standards to reference (Norway/Nordics)
- NEK EN 62446, IEC 62548, IEC 61724 (PV)
- IEC 62619, IEC 62933 (BESS)
- Statnett grid connection requirements
- NS 3420, NS-EN 1090 (structural)

## Guidelines
- Use numbered sections matching the tender's table of contents where possible
- State all assumptions explicitly
- Flag items pending engineering input with `[PENDING — engineering]`
- Always call `store_result` as the final step for each completed section
