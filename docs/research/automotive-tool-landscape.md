# Research: Automotive Engineering Tool Landscape — Aug 2026

**Date:** 2026-08-13 (survey imported 2026-08-16) · **Status:** research input for D9 tool registry + work packages
**Source:** external survey "Automotive Engineering Tool Landscape — Aug 2026" (research synthesis; vendor-claim caveats apply — see §4)
**Consumer:** `packages/catalog/src/fixtures.ts` (Tool Registry seeds), `packages/profiles` work packages, `packages/client-core` connection guides.

> What this doc adds to the D9 implementation: the **real toolchain of an automotive OEM**, mapped into registry entities (tool slugs, kinds, auth strategies, data classifications) and into 12 new role packages. It turns the pilot catalog from "plausible examples" into "the actual vendor landscape engineers already sit in front of."

---

## 1. Executive summary of the survey

- **10 tool categories** in an automotive engineering org: CAD, PLM/PDM, CAE/sim, digital twin/mfg simulation, embedded/MBD/AUTOSAR, ALM/requirements, program management, quality/APQP-PPAP, DevOps/VC, and (new, 2025-26) AI copilots/agents.
- **Structural trend:** Siemens displacing incumbents at the CAD/PLM core (Mercedes 2015, Bosch 2016, Hyundai/Kia 2021: $30-40M, 3-4k NX seats, ~10k Teamcenter licenses). PLM leadership: Siemens / PTC / Dassault, with Aras gaining.
- **CAE consolidation:** Cadence acquiring Hexagon D&E (Nastran/Adams/Marc, ~$2.9-3.17B); Siemens acquired Altair (HyperWorks) 2025; Synopsys closed Ansys acquisition 2025. Remaining independents: BETA CAE (ANSA/META), Gamma Technologies (GT-SUITE), AVL, Vector, dSPACE, cplace.
- **SDV push:** BMW standardizes enterprise requirements on PTC Codebeamer; Stellantis-dSPACE MOU targets 80-85% of testing on SIL (VEOS); Vector joins AUTOSAR core partners (Jan 2026).
- **DevOps has arrived:** JLR does 50-70 daily deploys to vehicle targets on GitLab; Mercedes runs 55k+ developers / ~115k repos on GitHub with 5k+ Copilot users.
- **AI copilots everywhere:** Siemens NX Design Copilot, Dassault Aura/Leo/Marie, PTC Codebeamer GenAI + Product Change Management Agent, GitHub Copilot at scale; GM: ~90% of autonomy-team code AI-generated, 300% increase in merged PRs after agent retooling.

## 2. ARM registry mapping (implemented)

40 tools seeded into `packages/catalog/src/fixtures.ts`. Naming convention: `<domain>.<tool>` slugs. Kinds: `cli` (desktop engineering app, local process invocation — no credential-bearing endpoint), `http_api` (REST/API), `connector` (VPC-internal system).

| Domain              | Tools (slugs)                                                                                   | Kind      | Auth         | Classification        |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------- | ------------ | --------------------- |
| CAD                 | cad.nx, cad.catia, cad.alias                                                                    | cli       | none (local) | confidential          |
| E/E + harness       | ee.capital, ee.e3-series, ee.preevision                                                         | cli       | none         | confidential          |
| PLM                 | plm.teamcenter, plm.windchill                                                                   | http_api  | pat          | confidential          |
| CAE                 | sim.ansa, sim.gt-suite, sim.star-ccm, sim.ls-dyna, sim.abaqus                                   | cli       | none         | confidential          |
| Model-based         | mdl.matlab-simulink                                                                             | cli       | none         | confidential          |
| Test                | test.canoe, test.dspace                                                                         | cli       | none         | confidential          |
| Calibration         | cal.inca                                                                                        | cli       | none         | confidential          |
| AUTOSAR             | autosar.tresos, autosar.davinci                                                                 | cli       | none         | confidential          |
| Requirements        | rm.jama, rm.polarion, rm.codebeamer, rm.valispace (pat) · rm.doors (oauth)                      | http_api  | pat/oauth    | internal              |
| Collab              | almjira (jira), docs.confluence, pm.cplace                                                      | http_api  | oauth/pat    | internal              |
| VCS                 | vcs.github, vcs.gitlab (pat) · vcs.azure-devops (oauth)                                         | http_api  | pat/oauth    | internal              |
| Quality             | spc.minitab (cli) · qms.aqua-pro (oauth) · qms.net-inspect (pat) · qms.sap-qm (service_account) | mixed     | mixed        | internal              |
| Mfg sim             | mfg.tecnomatix, mfg.delmia (cli) · dt.omniverse (oauth)                                         | mixed     | mixed        | confidential/internal |
| RTOS                | rt.qnx                                                                                          | cli       | none         | confidential          |
| Plant OT (existing) | cmms.sap-pm, historian.pi, mrp.erp, mes.andon, …                                                | connector | pat          | internal/restricted   |

**Design decisions encoded in the guardrail** (`tool-endpoint-scope`):

- Endpoint schemes allowed: `https://`, `internal://`, `mcp://`, **`cli://`** (new — local desktop apps).
- `confidential`/`restricted` tools may not use `auth_strategy: none` **except `kind: cli`** — desktop engineering apps (NX, ANSA, CANoe…) are local-process invocations with no credential-bearing endpoint; their data protection comes from the D2 classification gate on whatever they touch, not from an auth header.

## 3. New role packages (12, in `packages/profiles`)

Manufacturing +10: `cae_analyst`, `embedded_sw_engineer`, `systems_engineer`, `calibration_engineer`, `hils_engineer`, `program_manager`, `plm_administrator`, `mfg_sim_engineer`, `ee_architect`, `qms_apqp`. Tech +2: `devops_engineer`, `embedded_engineer`.

Coverage by survey category: CAD→(plm_administrator, ee_architect); PLM→(plm_administrator, qms_apqp via Windchill QS); CAE→(cae_analyst); digital twin/mfg sim→(mfg_sim_engineer); embedded/MBD/AUTOSAR→(embedded_sw_engineer, calibration_engineer, hils_engineer); ALM/RM→(systems_engineer); program mgmt→(program_manager); quality/APQP→(qms_apqp); DevOps→(devops_engineer); AI/agentic→(every package ships starter prompts + skills; the survey's GM/Bosch generate-and-check patterns are the template for `plc_programmer`/`embedded_sw_engineer` skills).

## 4. Caveats carried over from the survey

- Several tool-user pairings come from vendor marketing/customer-logo pages (Jama's "3 of top 5 OEMs" claim; VW-dSPACE case study) — treat as directional, not audited.
- Widely standard tools with no named automotive user in public record (CANoe, Siemens Capital, E3.series, Minitab, ETQ, Nastran/Adams, HyperWorks) are included because industry consensus is overwhelming; absence of a named user = sourcing gap.
- Seat counts/deal values are as-reported; the ~70% Teamcenter penetration figure is a single-source estimate.
- Registry `review_status` for all landscape tools is `approved` — in production, each tenant's Tool Registry should re-verify endpoints/auth against their own deployment before publishing.
