# Research: Job Types & Functions of an Automated OEM

**Date:** 2026-08-13 · **Status:** research input for D9 (Work Packages)
**Source:** four parallel research sweeps (business value chain, automated plant OT, product/manufacturing engineering, ARM schema mapping) — domain-knowledge primary, spot-checked against public sources.
**Consumer:** ARM industry-profile presets, Work Package catalog, personas, and work-type taxonomies.

> This doc answers: _what job types and functions exist inside an automated OEM?_
> `oem-work-package-design.md` answers: _what does each one do daily, and what should its ARM work package contain?_
> `token-cost-optimization.md` answers: _where does the token money go, and how do we save it?_

---

## 1. Mapping note: how this fits ARM today

ARM has **no literal "job type" or "function" entity** (checked across `packages/`, `apps/`, `docs/`). The closest modeled concepts:

| ARM concept               | What it is                                          | Where                                                                                             |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `taskType`                | static per-agent slug (`cnc_toolpath_optimization`) | `packages/profiles/src/types.ts:163`                                                              |
| `WorkTypeTaxonomy.labels` | per-department work-type label sets (D7)            | `packages/profiles/src/manufacturing.profile.ts:307-341`, `packages/db/src/schema/worktype.ts:29` |
| `rolePresets`             | title → permission bundle (D8)                      | `packages/profiles/src/types.ts:198-211`                                                          |
| `personas`                | human user roles                                    | spec §2, `types.ts:65-72`                                                                         |

**This taxonomy introduces the missing dimension.** Job types/functions should become the grouping key for a new **Work Package** concept (D9) — a role-scoped bundle of tools, skills, permissions, routing, and budgets — and feed richer `WorkTypeTaxonomy` labels + personas for the Manufacturing profile.

Conventions to respect: labels in lowercase `snake_case`; presets never gate capabilities (D6 governing rule); grouping by org-tree scope (department/plant); `unknown` is a first-class label, never guessed (D7).

---

## 2. Function map overview

Consolidated from four sweeps: **18 top-level functions, ~250 job types.**

| #   | Function                                      | Job types | Automation intensity           |
| --- | --------------------------------------------- | --------- | ------------------------------ |
| 1   | Design Studio                                 | 8         | High (CAS, rendering, CMF PLM) |
| 2   | R&D & Advanced Engineering                    | 7         | High (ADAS, AI/ML, sim)        |
| 3   | Product Engineering (Design-Release)          | 12        | High (E/E, embedded, safety)   |
| 4   | CAE / Simulation                              | 10        | High                           |
| 5   | Test & Validation                             | 8         | High (HIL, calibration)        |
| 6   | Systems Engineering / MBSE                    | 4         | High                           |
| 7   | Prototyping & Additive / Tooling & Die        | 5         | Medium                         |
| 8   | CAM / CNC Programming                         | 5         | Medium                         |
| 9   | Manufacturing Engineering / Process           | 18        | High                           |
| 10  | Production Operations                         | 10        | Medium (staffed lines)         |
| 11  | Maintenance & Reliability                     | 7         | Medium-High (PdM)              |
| 12  | Quality Management                            | 8         | Medium-High (SPC, vision)      |
| 13  | Supply Chain & Procurement                    | 10        | Medium (MRP)                   |
| 14  | Logistics & Material Flow                     | 9         | Medium (AGV/ASRS)              |
| 15  | Robotics & Automation Cells                   | 6         | Very high                      |
| 16  | Controls & Automation (PLC/MES/SCADA)         | 9         | Very high                      |
| 17  | Industrial IoT / Edge / OT Security           | 13        | Very high                      |
| 18  | Data Science / Digital Twin / Plant Analytics | 8         | Very high                      |
| 19  | Sales, Marketing & Aftermarket                | 20        | Medium                         |
| 20  | Business Services (Finance/HR/IT/Legal/EHS)   | 27        | Low-Medium                     |

---

## 3. Full taxonomy

### 3.1 Design Studio

Exterior Designer · Interior Designer · CMF Designer (Color/Material/Finish) · Digital Sculptor / Class-A Modeler · Clay Modeler · UX/HMI Designer · Packaging Engineer (Vehicle Integration) · Design Director / Chief Designer

### 3.2 R&D & Advanced Engineering

Research Scientist (Materials) · Advanced Powertrain Engineer · ADAS / Autonomous Driving Engineer · AI/ML Research Engineer · NVH Specialist (R&D) · Patent Engineer / IP Analyst · Technology Scout

### 3.3 Product Engineering (Design-Release)

Chief Engineer / Program Leader · Systems Engineer · Component Design Engineer · E/E Architecture Engineer · ECU Hardware Design Engineer · Wiring Harness Engineer · Embedded Software Engineer · Model-Based Controls / Algorithm Engineer · AUTOSAR BSW / MCAL Integration Engineer · Functional Safety Engineer (ISO 26262) · Embedded Cybersecurity Engineer (ISO 21434 / UNECE R155) · Diagnostics / OTA / Bootloader Engineer · CAD Designer / Drafter · PLM / BOM Engineer · DMU Engineer · Cost Engineer (Target Costing) · Joining / Fastener Engineer · Materials & Lightweighting Engineer · EMC Engineer · Signal/Power Integrity Engineer · Power Electronics Engineer

### 3.4 CAE / Simulation

FEA Structural Analyst · CFD / Aero Engineer · Crash & Occupant Safety Analyst · Durability & Fatigue Analyst · NVH Analyst · Thermal Systems Engineer · Multibody Dynamics (MBD) Engineer · Electromagnetic / Motor Analyst · 1D Systems Simulation Engineer · Simulation Data Management (SDM) Engineer

### 3.5 Test & Validation

HIL Test Engineer · SIL / MIL Test Engineer · Durability / Road-Load Data Engineer · Component / Bench Test Engineer · Powertrain Calibration Engineer · Homologation / Certification Engineer · Instrumentation / DAQ Engineer · Field / Fleet Test Engineer · Crash/Safety Test Engineer · NVH Test Engineer · Environmental Test Engineer · Prototype Build Engineer

### 3.6 Systems Engineering / MBSE

Requirements Engineer · MBSE / Model Architect · Functional Safety & Compliance Systems Engineer · System Integration Engineer

### 3.7 Prototyping, Additive & Tooling

Additive Manufacturing Engineer · Model Shop / Rapid Prototyping Technician · Tool & Die Design Engineer · Moldflow Analyst · Sheet-Metal Forming Simulation Engineer · Tool Tryout / Correction Engineer · Fixture / Gauge Design Engineer

### 3.8 CAM / CNC Programming

CNC Programmer · Multi-Axis Machining Specialist · Machining Simulation / Verification Engineer · Post-Processor Developer · CMM / Metrology Programmer

### 3.9 Manufacturing Engineering / Process

Process Engineer (Stamping/Body/Weld/Paint/Assembly) · Industrial Engineer · Automation / Controls Engineer · Robotics Cell Engineer · Tooling Engineer (Dies & Fixtures) · Factory Simulation Engineer · Manufacturing IT / MES Engineer · Launch / Program Manager (APQP) · DfM / DfA Engineer · Additive Manufacturing Engineer · BOP / MBOM Engineer · Assembly Process Planner · ECN / Change Management Coordinator · Dimensional Management Engineer · Welding / Joints Process Engineer · Paint / Coating Process Engineer · Electrification / Battery Process Engineer · Ergonomics / Human Factors Engineer · Throughput / Discrete-Event Simulation Engineer · Material Flow / Internal Logistics Engineer · Robot Simulation / OLP Engineer · Digital Twin / Virtual Commissioning Engineer · Smart Factory / IIoT Engineer · AGV / AMR Systems Engineer · Factory Layout / Greenfield Planning Engineer · PLM Administrator · CAD Administrator / Customization · CAD Methods / Design Automation (KBE) Engineer · PLM Business Analyst · CAD/PLM-ERP Integration Engineer

### 3.10 Production Operations

Plant Manager · Production / Value-Stream Manager · Shift Supervisor / Team Leader · Production Planner / Scheduler · Machine Operator (CNC/Press) · Assembly Technician · Paint Shop Technician · Battery Cell/Module Operator · Kaizen / CI Coordinator · Ramp-up Coordinator

### 3.11 Maintenance & Reliability

Maintenance Technician (Mech/Elec) · Robot/Automation Maintenance Technician · Maintenance Planner / Scheduler · Reliability Engineer · Predictive Maintenance (PdM) Analyst · CMMS Administrator · Spare Parts / MRO Manager · Multi-skilled Mechatronics Technician · Industrial Electrician · Line Technician · MRO / Spare Parts Coordinator · Condition Monitoring Technician · Vibration Analyst (Cat I–IV) · Reliability Data Analyst

### 3.12 Quality Management

Quality Manager (Plant) · Product Quality Engineer (PQE) · Supplier Quality Engineer (SQE) · SPC / Metrology Engineer · Incoming Inspection Technician (IQC) · Six Sigma Black Belt · Warranty / Field Quality Analyst · Quality Auditor (System/Process/Product) · Machine Vision Engineer · Vision Technician / Programmer · AOI Engineer · Vision Integration Engineer · Automated NDT Engineer · Quality Data Systems Engineer · In-Process / End-of-Line Test Engineer

### 3.13 Supply Chain & Procurement

Strategic Buyer / Commodity Manager · Program Buyer · Procurement Specialist (P2P) · Supplier Development Engineer · Material Planner (MRP) · Supply Chain Planner · Demand Planner (S&OP) · Supplier Risk / Resilience Analyst · VA/VE Cost Reduction Buyer · Localization Planner

### 3.14 Logistics & Material Flow

Logistics Manager (Plant) · Inbound/Outbound Coordinator · Warehouse Supervisor · Material Handler / Forklift Operator · Packaging Engineer · Sequencing (JIS) Planner · Transport Network Analyst · Customs & Trade Compliance Specialist · 3PL / Carrier Contract Manager · AGV/AMR Fleet Engineer · AMR Application Engineer · AS/RS Engineer · WMS/WCS Integration Engineer · Intralogistics Controls Engineer · Warehouse Automation Technician · AMR Safety Engineer

### 3.15 Robotics & Automation Cells

Robot Programmer · Robotics Technician · Robot Cell Designer · Cobot Application Engineer · EOAT Engineer · Robot Welding Engineer

### 3.16 Controls & Automation (PLC/SCADA/MES)

Controls Engineer / PLC Programmer · Controls Architect / Standards Engineer · Motion Control Engineer · Functional Safety PLC Engineer · HMI Developer · Process Automation Engineer (Batch) · Industrial Network Specialist · Instrumentation & Controls Technician · Commissioning Engineer · MES Engineer · MES Integrator / Developer · SCADA Developer · Historian Engineer · SCADA/Historian Administrator · MES Support Analyst · Manufacturing Systems Architect · BOP-MES Integration Engineer · Production IT / OT (PLC-SCADA) Engineer · Manufacturing Analytics / Data Engineer

### 3.17 Industrial IoT, Edge & OT Security

IIoT Architect · Edge Computing Engineer · OT Data Engineer · Protocol Gateway Specialist · Sensor Integration Engineer · OT Infrastructure Engineer · ICS/OT Security Engineer · OT Security Architect · OT SOC Analyst · OT Vulnerability & Patch Manager · Secure Remote Access Specialist · Plant IT Infrastructure Engineer · OT Asset & Configuration Manager

### 3.18 Data Science, Digital Twin & Plant Analytics

Manufacturing Data Scientist · OEE / Performance Analytics Engineer · Digital Twin Engineer · Simulation Engineer (DES) · Golden Batch / Process Analytics Engineer · Edge ML Engineer · Analytics Platform Engineer · Energy & Sustainability Analyst

### 3.19 Sales, Marketing & Aftermarket

Sales Director · Key Account / Fleet Sales Manager · Dealer Network Development Manager · Product Manager (Lineup & Pricing) · Brand Marketing Manager · Digital Marketing Specialist · Market Research / Competitive Analyst · Sales Operations / Incentives Analyst · CRM Manager · PR / Communications Manager · Aftersales Director · Parts Catalogue Specialist · Spare Parts Planner · Parts Pricing Analyst · Warranty Administrator / Analyst · TSB Engineer · Field Service Engineer · Service Training Instructor · Dealer Technical Support (Hotline) · Remanufacturing Engineer · Connected Services / Telematics Engineer · Customer Care / Contact Center Agent

### 3.20 Business Services (Finance / HR / IT / Legal / EHS)

Controller / FP&A Analyst · Plant Controller · Program Finance Manager · Cost Accountant · Treasury Analyst · Internal Auditor · Tax Specialist · Investor Relations Manager · HR Business Partner · Talent Acquisition Specialist · Technical Trainer (L&D) · HRIS / Payroll Analyst · Enterprise Architect (ERP Core) · ERP / MES Functional Analyst · Data Engineer / BI Analyst · IT Service Desk / Field Tech · Commercial Counsel · IP Counsel · Product Liability Counsel · Compliance Officer (Export Controls) · Facilities Manager · Utilities / Energy Engineer · EHS Manager · Safety Engineer · Environmental Engineer · Ergonomist · Sustainability / ESG Manager

---

## 4. ARM enrichment hooks (derived)

### 4.1 Gaps vs current Manufacturing preset

Current preset models a CNC parts shop (Engineering, Production, QC, Maintenance, Procurement, R&D). An OEM needs additionally: **Design Studio, Program Management, Sales & Marketing, Aftermarket & Service, Finance, HR, IT/OT, Legal/Compliance, EHS & Facilities.**

### 4.2 New work-type labels worth adding

`cae_simulation` · `crash_analysis` · `homologation_docs` · `plm_change_management` · `embedded_software_generation` · `functional_safety_case` · `bom_cost_rollup` · `warranty_claim_analysis` · `tsb_generation` · `parts_cataloguing` · `sourcing_rfq_analysis` · `plant_simulation` · `oee_dashboarding` · `export_control_screening` · `recall_risk_modeling` · `service_manual_generation` · `dealer_comms` · `plc_programming` · `robot_programming` · `hmi_development` · `mes_configuration` · `scada_development` · `historian_query` · `iiot_edge_mgmt` · `ot_security_monitoring` · `vibration_analysis` · `vision_job_tuning` · `digital_twin_modeling` · `amr_fleet_management` · `cmm_metrology` · `energy_analytics` · `fea_simulation` · `mbse_modeling` · `hil_testing` · `robot_offline_programming` · `ecn_management` · `virtual_commissioning`

### 4.3 New personas

`program_chief` (Chief Engineer — natural fit for invariant #7's one-accountable-human), `design_lead`, `aftersales_manager`, `plant_controller`, `ehs_manager`, `ot_security_lead`.

### 4.4 Reusable taxonomy labels (already in preset)

`cnc_toolpath_optimization` · `defect_analysis` · `spc_analysis` · `predictive_maintenance` · `demand_forecasting` · `route_optimization` · `supplier_evaluation` — all map cleanly onto the OEM job families above.
