---
title: "D6: Industry Profile — provisioning preset, not runtime mode"
date: 2026-08-02
status: proposed
supersedes: none
---

# D6: Industry profile (Manufacturing vs Tech)

> Companion entry in `docs/open-decisions.md` (D6). Blocks: tenant onboarding +
> the manufacturing-fit work surfaced in the 2026-08-02 codebase review. Not yet
> locked — pending architecture + product sign-off.

## Decision (recommended)

Model "manufacturing mode" vs "tech mode" as a **provisioning-time Industry
Profile preset** (a data bundle applied at tenant creation), **not a runtime
`mode` enum that branches behavior.** Ship two named presets — **Tech** and
**Manufacturing** — plus a **Custom** escape hatch. After provisioning, a profile
manifests as normal per-tenant config rows; runtime code reads config, never
`mode`. The governing rule:

> **Everything that makes ARM good for manufacturing is a _capability_ every
> tenant could have. The profile only ever sets _defaults_ — it never gates a
> capability.**

This keeps hybrid companies (tech + hardware division, manufacturer + large
software org, holding company running both) first-class: one tenant, two
flavors, zero migration.

Orthogonal to existing axes: any profile × any delivery model (SaaS /
self-hosted, §3.4) × any commercial tier. A manufacturing company can be SaaS
_or_ self-hosted; profile is a separate dimension.

## Context

The seed tenant is already "Acme Manufacturing Corp" and the simulation already
runs manufacturing agents (CNC toolpath optimization, defect analysis, demand
forecast). The governance engine (budgets, tiers, deny-overrides, metering,
audit) is industry-neutral. What differs between a tech company and a
manufacturer is ~10 dimensions of _default values_ — not engine features:

| Dimension                | Tech preset                                                    | Manufacturing preset                                                                            |
| ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Org-tree convention      | flat: Eng/Product/Sales/CS/Marketing                           | deep: Plant → Line/Cell → Station **+ shift dimension**                                         |
| Personas (spec §2)       | engineer, marketer, sales, CS, manager, admin, InfoSec         | plant manager, shift lead, maintenance planner, QC/process engineer, supply chain, OT-Security  |
| Resource-type allowlist  | s3, gcs, db, sharepoint, onedrive, files + GitHub/Slack/Notion | + mes, erp, scada, historian, plm, cmms, iot                                                    |
| Classification taxonomy  | single-axis: public/internal/confidential/restricted           | **dual-axis**: sensitivity rank **+ regulatory flag** (ITAR/EAR, GxP)                           |
| DLP pattern library      | API keys, SSNs, credit cards, PII                              | + process recipes, CAM/tooling, CAD geometry, customer specs, quote/cost, export-controlled     |
| Priority-tier naming     | critical=incident, standard, background=ux/upgrade             | critical=**line-blocking/line-down**, standard=CI/engineering, background=optimization/training |
| Budget-period presets    | monthly                                                        | **shift / line / batch / monthly**                                                              |
| Model-routing default    | cost-steer to open cloud models (GLM/DeepSeek)                 | **edge/on-prem GPU first** (data residency); geo-restricted for ITAR                            |
| Connectivity assumptions | cloud-native, remote=VPN                                       | **air-gapped plants**, plant-local enforcement, offline policy TTL, periodic sync               |
| Stakeholder routing      | single human, business hours                                   | single human of-record **+ shift duty roster** for alerts/JIT                                   |
| Seed/demo agents         | code-review, docs, arch, test-gen, security-scan               | CNC-toolpath, defect/SPC, demand-forecast, predictive-maintenance, route-opt                    |
| UI home panels           | spend / org / savings                                          | + line uptime, maintenance backlog, quality holds, shift handover                               |

None of the right column is a new engine feature — it is defaults plus a few new
resource types, plant/line/shift scoping, and dual-axis classification.

## Options considered

- **(a) Runtime `mode` enum on Tenant, branches in code.**
  `tenant.mode ∈ {tech, manufacturing}`; `if (mode === 'manufacturing') {...}`
  across proxy/policy/UI. Simple to conceptualize; single switch.
- **(b) Industry Profile — declarative preset applied at provisioning (data, not code).**
  A profile is a bundle of default config (role catalog, classification taxonomy,
  resource-type allowlist, DLP patterns, tier display names, budget-period
  presets, persona→home-panel mapping, seed agents). Selected in an onboarding
  wizard at tenant creation; materialized as per-tenant config rows. Runtime code
  reads config, never `mode`. The UI may _display_ the profile but no behavior
  branches on it. **(recommended)**
- **(c) Hybrid — (b) for behavioral config + a lightweight `uiExperience` label
  for navigation/persona presentation only**, with the presentation also
  registry-driven (panels keyed by experience) rather than hardcoded if/else.
  Strictly a specialization of (b); folds in once (b) lands.

## Rationale

(b) wins because:

1. **No `if (mode)` trap.** Branching on a 2-value enum across proxy, policy,
   and UI creates combinatorial test surface, couples behavior to identity, and
   doesn't scale past two industries (healthcare and finance are already on the
   roadmap — see `docs/solutions/competitive-analysis.md` verticals). The profile
   mechanism scales to N industries with zero new branching.
2. **Capabilities ≠ defaults (the hybrid-company rule).** The things that make
   ARM fit manufacturing — OT resources, air-gapped enforcement, dual-axis
   classification, shift-awareness — are capabilities any tenant may enable.
   Hardcoding them behind a mode gate would force a hybrid company to lose one
   flavor's defaults. A profile of _defaults_ lets any tenant turn on any
   capability; "Custom" is the à-la-carte path.
3. **Fits existing machinery.** §6.6 already has scope-admin-authored
   "templates" with `spawned_by ENUM('user','automation','template')`. An
   Industry Profile is the _tenant-level_ analog of an agent template — same
   pattern, lifted one level. The `tenantTable` already carries `tier`,
   `deployment`, `licenseJson`; `industryProfile` is a natural sibling.
4. **Auditable & explicit.** Each tenant's config is real rows (classifications,
   roles, DLP patterns, allowlists) — inspectable, editable, versioned — rather
   than behavior implicit in a mode flag. Aligns with the audit-first posture
   (invariants 1, 7) and the Spec Travel Rule (§14.3).
5. **Move-hardcoded→config is needed anyway.** DLP patterns are hardcoded in
   `apps/simulation/src/proxy.ts`; personas are hardcoded in spec §2; demo data
   is hardcoded in `mock-data.ts`. Promoting these to tenant-owned config is the
   target state regardless of mode — the profile preset just seeds it.

## Consequences

### Data model

- New `tenant.industryProfile` column (`tech` | `manufacturing` | `custom`) on
  `tenantTable` (`packages/db/src/schema/org-tree.ts`). **Default-source only**;
  never branched on at runtime. Paired with `profileAppliedAt`.
- Promote hardcoded surfaces to tenant-owned config: DLP-pattern table,
  role-catalog table, resource-type allowlist. (Classification taxonomy already
  lives in `classificationLevelTable`.)
- Manufacturing capabilities become tenant-toggleable features (not mode-gated):
  plant/line/shift scope types in `scopeTypeEnum`, OT resource types in
  `resourceTypeEnum`, dual-axis classification, offline policy TTL, shift duty
  roster.

### Code

- New `packages/profiles` (leaf, no internal imports — sits beside
  `proto`/`config`): declarative preset definitions
  (`tech.profile.ts`, `manufacturing.profile.ts`) as pure data.
- Provisioning step applies a preset → seeds config rows for that tenant.
- Web UI: onboarding "What kind of company?" step (the _selector_ users ask for,
  one-time at tenant creation) + a **registry pattern** for personas/home panels
  keyed by profile. No `if (mode)` in proxy/policy/enforcement.

### Guardrail

- New `guardrails/no-profile-branching`: fails if `industryProfile` is read
  inside proxy / policy / enforcement paths (only UI presentation + provisioning
  may read it). Mutation-proofed per §14.2 (inject a `mode` branch, watch it go
  red, restore). This is the guard that keeps the hybrid-company rule true.

### Phased plan

- **Phase 1 (quick win):** `industryProfile` column + `packages/profiles` with
  two pure-data presets; onboarding applies the preset (classifications, roles,
  DLP patterns, allowlist, demo agents, UI panel set); UI reads profile for
  presentation via registry; second simulation seed so the demo toggles Acme
  Manufacturing ↔ a Tech tenant. Acceptance: a manufacturing tenant shows plant
  personas / OT resources / dual-axis classification / shift budgets on first
  load; a tech tenant shows the current experience.
- **Phase 2 (clean target):** complete the move-hardcoded→config migration so
  the profile is a _pure_ default bundle; manufacturing capabilities are
  tenant-toggleable; "Custom" is first-class; a hybrid tenant configures tech
  defaults at org level + manufacturing capabilities for a plant subtree.

### Docs (Spec Travel Rule — same PR as implementation)

- `docs/CONCEPTS.md`: add `Industry Profile`, `Preset`,
  `Capability Toggle` vs `Profile Default`.
- `docs/arm-spec.md` §3.4: profile axis (independent of delivery + tier).
- `docs/arm-spec.md` §2 / §5.3: personas and IA become profile-driven
  (registry); document the manufacturing persona set.

## Open sub-decisions (see open-decisions.md D6)

1. Switchable after provisioning? → recommend **no by default** (re-seed + data
   migration); "Custom" for à-la-carte; a guarded "re-apply defaults" admin
   action is later.
2. Does profile gate capabilities? → **No.** (The rule above.)
3. First-preset set → Tech + Manufacturing + Custom only.
4. Selector location → tenant-creation onboarding wizard (one-time); UI shows
   the active profile as a label, not a toggle.
5. N>2 industries → the mechanism scales; do not pre-build healthcare/finance.

## Risks

- **Profile-creep into runtime branching** (top risk) → mitigated by
  `guardrails/no-profile-branching` (mutation-proofed).
- **Two sources of truth** during Phase 1–2 transition (some defaults still
  hardcoded while others moved to config) → mitigate by completing Phase 2 and
  requiring each preset to _own_ every value it claims to own.
- **Migration tax from picking the wrong shape** → exactly why this record
  locks the profile-over-mode shape _before_ code lands.

## Status

**Proposed 2026-08-02.** Not yet locked. Decision needed before tenant-onboarding
work and the manufacturing-fit slice. Owner: architecture + product. Once locked,
update spec §2/§3.4/§5.3 + `CONCEPTS.md` in the same PR per §14.3.
