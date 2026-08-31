# Research: OEM Work Package Design — Daily Work → Tool Packages → Token Profiles

**Date:** 2026-08-13 · **Status:** research input for D9 (Work Packages)
**Source:** five parallel deep sweeps (design/engineering, automated plant OT, mfg ops/quality/SCM, business/support, token economics), consolidated and deduplicated.
**Consumer:** the Work Package catalog — what each role does daily, what tools/plugins its package must bundle, and what its token spend looks like.

> Pair with `oem-job-taxonomy.md` (who exists) and `token-cost-optimization.md` (how to make it cheap).

---

## 1. How to read this doc

Each family section lists: **daily work patterns** (what these people actually do every day), **package essentials** (what an ARM Work Package must bundle), and **token profile** (High ≈ ≥50K tokens/day, Medium ≈ 10–50K, Low ≈ <10K of generated + context tokens).

The end of each section is the input to D9 package presets. Design rule throughout: **the package is the governance unit** — every tool, connector, and template inside it is metered, authorized, and budgeted by ARM.

---

## 2. Shared package backbone (build once, bundle everywhere)

**Connectors (~80% of package value):**

- **ERP**: SAP (PP/MM/QM/WM/FI/CO), Oracle — master data, BOMs, POs, costing
- **MES**: Siemens Opcenter, Plex, Critical Manufacturing — routings, WIP, genealogy, traceability
- **WMS/WCS**: Manhattan, Blue Yonder — inventory, picks, ASRS handoffs
- **CMMS**: SAP PM, IBM Maximo — work orders, assets, PM schedules
- **PLM/PDM**: Teamcenter, Windchill — parts, ECNs, drawings
- **Historian**: AVEVA PI, InfluxDB — time-series process data
- **OT field**: OPC UA/DA, Modbus, MQTT/Sparkplug B, Profinet diagnostics
- **Ticketing**: Jira, ServiceNow; **Docs**: SharePoint/Confluence
- **CRM/DMS**: Salesforce, dealer DMS; **ATS/HRIS**, **TMS**, **CLM**, **LMS**

**Standard libraries (reusable template packs):**

- AIAG core tools: APQP / PPAP / FMEA / MSA / SPC
- Quality: VDA 6.3, VDA 8D, IATF 16949 clauses, CQI special-process assessments
- Safety/security: ISO 26262, ISO 21434, ISO 13849/IEC 62061, IEC 62443, ISO 12100, ISO 10218/TS 15066
- Welding/process: ISO 9606/15614, ISO 14373/18278, AWS CQI-9/12/15/17
- Regulations: UNECE R155/R156, FMVSS, EU 2018/858, REACH/IMDS/GADSL, CSRD/ESRS, ISO 14001/45001/50001

**The plant's single highest-value agent loop (fits every technical family):**
`alarm/fault feed → root-cause identification (fault-code KB + history) → fix instructions (IETM/SOP) → CMMS work order → closure report`.
Design this loop once as a shared package component; every maintenance/controls/robot role reuses it.

---

## 3. Family-by-family work-package design

### 3.1 Design Studio — **Medium-High tokens**

- **Daily work:** sketch/theme iteration; A-class surfacing loops (Alias/ICEM); gap/flush + curvature audits; CMF palette/spec sheets (Pantone, VDI 3400, IMDS); ergonomic package checks (SAE J1100, RAMSIS); HMI wireframes + driver-distraction compliance; management review decks; benchmark teardown boards.
- **Package:** CAS/CAD connectors (Alias/VRED, Catia GSD, JT viewers); image-generation for ideation; CMF material DBs (Granta/M-Base) + regulatory substance DBs (IMDS, GADSL); SAE J1100/J826 libraries; brand design-language library; review-deck templates; mesh↔NURBS utilities.
- **Cost drivers:** iterative visual exploration, long design briefs, surface-quality report generation.

### 3.2 R&D & Advanced Engineering — **High tokens**

- **Daily work:** materials qualification campaigns + CAE material-card generation; powertrain simulation decks (GT-SUITE); ADAS scenario-catalog curation + SOTIF safety cases; model eval harness runs + fine-tuning; NVH transfer-path analysis; prior-art searches + patent drafting; horizon scanning + tech-due-diligence digests.
- **Package:** sim/CAE runners (GT-SUITE, STAR-CCM+, MATLAB); sensor/fleet data pipelines (ROS, telematics); patent DBs (USPTO/EPO/PatSnap) + CPC maps; paper DBs (SAE, IEEE); MLOps connectors (W&B, MLflow); eval harnesses; report generators.
- **Cost drivers:** long literature reviews, big sim decks, safety-case doc generation, claim drafting.

### 3.3 Product Engineering — **High tokens**

- **Daily work:** requirements flow-down + FMEA facilitation; CAD part design + GD&T + tolerance stacks; E/E topology + signal DB maintenance; AUTOSAR BSW/ASW code + MISRA fixes; HARA/ASIL + FMEDA safety cases; TARA + SBOM reviews; PLM release/ECN processing; should-cost models.
- **Package:** CAD + PLM connectors; DOORS/Polarion/Jama + ReqIF; FMEA/safety-case/template suites (APIS IQ-class); ARXML/DBC signal tooling; MISRA/static-analysis checkers; GD&T libraries (ASME Y14.5); tolerance tools (3DCS/VSA); standard-part catalogs; 8D templates.
- **Cost drivers:** requirements DBs are long-context monsters; templated-but-huge safety/security docs; codegen + PR review loops.

### 3.4 CAE / Simulation — **High tokens**

- **Daily work:** meshing + solver deck setup + run management (HPC queues); post-processing (Cp plots, mode shapes, intrusion metrics); test correlation (wind tunnel, rig data); optimization loops (NVH/durability); long-form CAE reports.
- **Package:** pre/post processors (ANSA/HyperMesh/Meta) + solver runners; HPC queue connectors; report templates; correlation scripts; plot/dashboard generation.
- **Cost drivers:** massive decks, many runs, image-heavy reports; session length grows with iteration count.

### 3.5 Test & Validation — **High tokens (calibration/homologation especially)**

- **Daily work:** HIL rig builds + fault injection; MIL/SIL MC/DC coverage runs; proving-ground data QC + load-case extraction; bench procedure execution + teardown reports; engine/e-motor map calibration + dataset releases; type-approval dossiers (EU/FMVSS/CCC); fleet telemetry triage.
- **Package:** test-automation runners (dSPACE, NI, TestStand); DAQ connectors (SoMat, Dewesoft); regulation libraries (UNECE, FMVSS, CCC) + dossier templates; dataset management (CDS); drive-cycle protocol packs (WLTP/FTP); telematics dashboards.
- **Cost drivers:** huge measurement datasets, optimization loops, dossier documentation, long test reports.

### 3.6 Systems / MBSE — **High tokens**

- **Daily work:** requirements elicitation + traceability linking; SysML model development + validation rules; integration test plans + issue triage.
- **Package:** DOORS NG/Polarion/Jama; Cameo/Capella/Rhapsody; ReqIF exchange; traceability matrix generators; model-diff tools; doc generators; ASPICE templates.
- **Cost drivers:** model churn, diagram/doc export, impact analyses over large requirement sets.

### 3.7 Prototyping / Additive / Tooling — **Medium-High tokens**

- **Daily work:** build prep (orientation/supports) + print-farm monitoring; stamping-die/die-face design + forming sims; mold fill/pack/warp analysis; fixture/gauge design with datum realization; tryout punch-list management.
- **Package:** slicers + build-sim (Magics, 3DXpert); AutoForm/LS-DYNA runners; Moldflow/Moldex3D; GD&T + DMIS libraries; NAAMS/catalog components; tryout trackers.
- **Cost drivers:** large meshes, many sim iterations, geometry export loops.

### 3.8 CAM / CNC — **Medium tokens**

- **Daily work:** toolpath generation (rough/semi/finish) + tool selection; 5-axis collision checking; G-code verification (Vericut); post-processor development; CMM programs + GD&T evaluation.
- **Package:** CAM automation (NX CAM, hyperMILL) + tool libraries (CoroPlus); machine-kinematics models; post-builder tooling; Vericut runners; CALYPSO/PC-DMIS; SPC tools.
- **Cost drivers:** geometry-heavy batch jobs; moderate code generation.

### 3.9 Manufacturing Engineering / Process — **Medium-High tokens**

- **Daily work:** press/BIW/paint/assembly parameter tuning + recipe DB updates; robot program validation vs weld specs; dimensional convergence loops (CMM → shim decisions); PFMEA/CP maintenance; standard-work updates; APQP deliverable tracking (PPAP/PSW/APQP matrix); DfM/DfA scorecards; ECN impact analysis; factory discrete-event simulation; virtual commissioning of PLC logic.
- **Package:** process-sim runners (AutoForm, Process Simulate, Plant Simulation); CMM/optical metrology connectors; AIAG APQP/PPAP/FMEA/MSA/SPC template suites; weld-schedule libraries; ECN/change workflows (PLM); andon/event connectors; takt/line-balance (Yamazumi) tools; DfM rulebooks.
- **Cost drivers:** geometry convergence loops, change documentation, PFMEA edits, launch status decks, PPAP packages.

### 3.10 Production Operations — **Low-Medium tokens (volume: thousands of seats)**

- **Daily work:** KPI reviews (SQDCME) + gemba walks (manager tiers); shift staffing + andon response + end-of-shift reports (supervisors); production sequencing vs mix/constraints (planners); standard work + first-off checks + MES logging (operators); kaizen events + A3s.
- **Package:** KPI cockpits; shift-report auto-generation from MES/andon; sequencing optimizers (SAP PP/DS, Kinaxis); digital work-instruction viewers; first-off checklists; 5S/TPM checklist apps; A3/PDCA templates; voice/scan MES helpers.
- **Cost drivers:** high frequency × short transactions — keep packages tiny, deterministic, and cheap-model-first; this is where per-transaction savings compound hardest.

### 3.11 Maintenance & Reliability — **Medium-High tokens**

- **Daily work:** PM execution + breakdown response + CMMS logging; servo/PLC fault isolation; weekly PM scheduling around production windows; MTBF/MTTR bad-actor analysis + RCA (5-Why/FTA); vibration/thermal route analysis + condition reports; MRO stock classification + expedites.
- **Package:** CMMS connector (mobile-first); fault-code KBs (Fanuc/KUKA/ABB/Siemens); IETM repair instructions; spare-part cross-reference; vibration libraries + FFT tooling (ISO 10816); Weibull/RCM calculators; RCA template suites; escalation matrices.
- **Cost drivers:** RCA reports, condition reports, diagnostic sessions; the fault→fix→CMMS loop is the flagship agent workflow.

### 3.12 Quality Management — **High tokens (8D/PPAP roles)**

- **Daily work:** defect root-cause + 8D authoring; control-plan + boundary-sample management; supplier SCAR/8D + VDA 6.3 audits; CMM/gauge programs + MSA GR&R; incoming inspection sampling (ANSI Z1.4); warranty claim Pareto/early-warning analytics; IATF internal audits; vision/AOI program tuning; EOL test sequence development.
- **Package:** VDA 8D/AIAG template suites; SPC charting automation; MSA calculators; sampling-plan calculators; audit checklist libraries (IATF, VDA 6.3, CQI); warranty data connectors + early-warning analytics; PPAP review checklists; chargeback calculators; vision tooling (Cognex/Halcon) + GR&R.
- **Cost drivers:** 8D reports, PPAP packages, audit reports — the doc-heaviest family in the plant.

### 3.13 Supply Chain & Procurement — **Medium-High tokens (MRP is High by volume)**

- **Daily work:** MRP exception triage (shortages/expedites/overstock) + PO release; RFQ/quote analysis + TCO models; supplier scorecards + VDA 6.3 audits; S&OP demand forecasts + accuracy tracking; tier-N risk mapping + disruption scenarios; teardown/should-cost benchmarking; invoice-matching exception handling.
- **Package:** MRP/APS connectors + exception-triage bots; e-sourcing connectors; TCO/should-cost calculators; contract libraries; market-index feeds (LME/steel); supplier portal connectors; scenario simulators; BCP templates.
- **Cost drivers:** exception triage is voluminous daily; RFQ packages + should-cost analyses are deep per-unit.

### 3.14 Logistics & Material Flow — **Medium tokens**

- **Daily work:** dock scheduling + ASN reconciliation; JIS sequence planning + resequencing on disruption; milk-run/lane optimization; customs classification + FTA origin certificates; packaging density/cube optimization; AGV fleet config + deadlock troubleshooting; WMS/WCS message-flow testing.
- **Package:** TMS/WMS connectors; sequencing optimizers + resequence engines; network optimization models; HTS classification DBs + FTA rules-of-origin tools; FMS config tooling (VDA 5050); pack-density calculators; dock schedulers.
- **Cost drivers:** resequencing runs, network models, RFQ data packs; day-to-day ops are exception-heavy but short.

### 3.15 Robotics & Automation Cells — **High tokens (programmers)**

- **Daily work:** robot program development + touch-ups (TP/KRL/RAPID/URScript); cycle-time + collision-zone tuning; controller backups + version diffs; servo/encoder fault recovery; cell design + ISO 10218 risk assessments; cobot force/pressure assessments; weld schedule tuning + seam tracking.
- **Package:** robot-brand codegen libraries; offline-sim connectors (RoboDK, Process Simulate); alarm-code lookup tables; backup/restore + diff tooling; cycle-time profilers; ISO 10218/TS 15066 risk-assessment generators; weld-schedule libraries (material × thickness).
- **Cost drivers:** path codegen, alarm triage, backup diffing, risk-assessment docs.

### 3.16 Controls & Automation (PLC/MES/SCADA) — **High tokens**

- **Daily work:** ladder/ST/FBD logic development + online debug (TIA Portal, Studio 5000); AOI/UDT/faceplate library governance; servo tuning + cam profiles; safety-PLC V&V + SIL/PL calcs; HMI screens + ISA-101 alarm classes; ISA-88 recipe/phase logic + EBRs; MES routing/master-data config + ERP reconciliation; SCADA tag DBs + scripting; historian AF hierarchies + compression tuning; FAT/SAT execution + punch lists.
- **Package:** PLC codegen (ladder/ST) + project diff/merge; drive parameter libraries + sizing calculators; SIL/PL calculators (SISTEMA-class); HMI/SCADA screen codegen (Ignition JSON, WinCC); ISA-88 recipe editors; MES APIs + ISA-95 mapping templates; AF SDK element-template codegen; FAT/SAT checklist suites; alarm-matrix templates.
- **Cost drivers:** state-machine codegen, tag-mapping configs (enormous), alarm configuration, commissioning reports.

### 3.17 Industrial IoT, Edge & OT Security — **High tokens (SOC/triage roles)**

- **Daily work:** IIoT architecture + asset models; edge deployment + fleet orchestration; OT data pipelines (OPC UA → Kafka → lakehouse); protocol gateway tag maps; ICS/OT monitoring + alert triage (IEC 62443, MITRE ATT&CK ICS); vulnerability scanning + CVE-to-asset mapping + patch windows; secure remote-access session audits; CMDB reconciliation.
- **Package:** ETL codegen (Kafka Connect); gateway config generators (Kepware, Node-RED); SIEM query codegen + Sigma/Zeek rule libraries; IEC 62443 checklist suites; scan-report parsers + CVE-asset mapping; firewall rule generators; access-review templates; baseline diff tooling.
- **Cost drivers:** alert triage summaries, rule writing, assessment reports, huge tag maps.

### 3.18 Data Science, Digital Twin & Plant Analytics — **High tokens**

- **Daily work:** historian/MES data exploration + defect/yield models; OEE loss-tree analysis + dashboards; digital-twin model dev + calibration; discrete-event sim experiments; golden-batch PCA comparison; edge ML deployment + drift monitoring; energy-per-unit normalization + GHG reporting.
- **Package:** PI/OPC UA data connectors; feature-extraction + ML pipeline codegen; OEE calculators + reason-code normalization; Modelica/Python model tooling; experiment automation; conversion/quantization tooling; ISO 50001 templates; GHG calculators.
- **Cost drivers:** analysis code, model loops, dashboards, reports — context-heavy data work.

### 3.19 Sales, Marketing & Aftermarket — **Medium-High tokens (bid/TSB/warranty roles High)**

- **Daily work:** fleet RFQ/TCO bid responses; dealer scorecards + territory analytics; price-list management + trim walks; campaign briefs + compliance sign-off; ad copy at scale + A/B tests; warranty claim adjudication + supplier chargebacks; TSB authoring + diagnostic steps; parts catalogue ECN updates; telematics data-quality + OTA campaign docs; CSRD/ESG reporting (bursty, High).
- **Package:** CRM/DMS/CPQ connectors; TCO calculators; tender/RFQ template libraries; warranty claim rule engines + early-warning analytics; TSB authoring templates; dealer scorecard engines; price-benchmarking feeds; telematics analytics notebooks; ad-platform APIs + copy generators.
- **Cost drivers:** bespoke bid documents, warranty evidentiary bundles, TSBs, long analytical reports.

### 3.20 Business Services (Finance/HR/IT/Legal/EHS) — **Low-Medium baseline, bursty High**

- **Daily work:** month-end close + variance commentary (FP&A); standard costing + PPV analysis (plant controller); payroll cycles + HRIS integrity; SOX control testing + workpapers; contract drafting/redlining (commercial counsel); FTO searches + patent drafting (IP); export-control screening + license applications; EHS incident investigations + regulatory filings; energy audits + ESG data collection; service-desk L1 tickets + KB articles.
- **Package:** ERP FI/CO + EPM connectors; SOX control libraries + workpaper templates; CLM + clause libraries + redline compare; patent DBs + docketing; sanctions-screening APIs + classification DBs; EHS software (Intelex-class) + ISO 14001/45001/50001 libraries; CSRD/ESRS framework packs; ITSM connectors + KB authoring.
- **Cost drivers:** contract review is the single most token-intensive legal task; tax/ESG seasons are bursty peaks; day-to-day is deterministic and cheap.

---

## 4. Cross-cutting design rules for ARM packages

1. **Two cost archetypes, two package shapes:**
   - **Volume jobs** (operators, techs, contact center, service desk, HRIS, MRP): token cost is _frequency-bound_ — tiny deterministic tools, cheap models + retrieval, checklist/SOP-first UX, mobile-friendly. These scale to thousands of seats; a 10% per-transaction saving here outweighs any depth job.
   - **Depth jobs** (legal, safety, CAE, calibration, TSB, ESG): token cost is _context-bound_ — long-context routing, RAG over standards, template generation, per-document cost caps, and prompt caching.
2. **The fault-code → root cause → fix → CMMS loop** is the flagship shared agent workflow across families 3.11/3.15/3.16/3.17. Build it once in the platform, parameterize per equipment vendor.
3. **Standards libraries are cache-first**: ISO/IEC/ISA/AIAG/VDA texts are read thousands of times per tenant — embed once per tenant (version-keyed), never re-send in context.
4. **Every package ends in a governance surface**: budgets per package, tool authorization, approval hooks, and `cost-per-work-product` telemetry (see `token-cost-optimization.md` §3) — the package is where governance and ease-of-use meet.
5. **Low/Medium-token roles still need packages** — that is the "very easy to use" requirement. Their package is smaller but must exist: SSO, 2-click install, voice/scan input, and zero config files.
