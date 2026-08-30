---
title: "GTM market-tier sequencing + Installation Wizard plan"
date: 2026-08-25
status: in-progress
supersedes: none
---

# GTM Market-Tier Sequencing + Installation Wizard

Business decision (2026-08-25): sequence go-to-market by persona —
**beachhead** (senior managers — key decision maker, low-hanging fruit),
**neighboring** (PD-DRE / engineering product managers, project managers),
**other** (engineers — a real differentiator, but lower priority). Plus a
product idea: an installation wizard that (1) asks job function, (2) asks
tasks/pain points via multiple choice + free-text write-ups an AI parses,
(3) scans a shared work folder to infer needs from file types, (4) scans the
machine for existing plugins/bundles.

## Part 1 — market tiers as real system data (shipped this slice)

`JobFunctionSeed` (`packages/profiles/src/types.ts`) gained an optional
`marketTier?: "beachhead" | "neighboring" | "other"`. Undefined means "not
part of the explicit GTM sequencing" — mostly the ~250 manufacturing and ~60
tech individual-contributor roles, which stay exactly as detailed as before.
This is metadata for prioritization (which persona the onboarding UI should
surface first), never an eligibility gate — consistent with D6's "profiles
set defaults, never gate a capability."

Concretely:
- **`senior_manager`** (beachhead) — added to all four profiles
  (tech/manufacturing/finance/holding), each with a matching `WorkPackageSeed`:
  dashboards + approvals-inbox + web-search, framed around *their* ARM
  adoption funnel, budget/spend, and approvals — not hands-on tool use. In
  manufacturing, `plant_manager` was also tagged beachhead (already an exact
  fit).
- **Neighboring** — `product_manager` (tech, already existed) and a new
  `project_manager` (tech) tagged neighboring, with a status/blocker-digest
  work package. In manufacturing: `chief_engineer_program_leader` and
  `launch_program_manager_apqp` (already existed — the manufacturing "project
  manager") tagged neighboring, plus a new `design_release_engineer`
  (PD-DRE) job function + work package (Teamcenter/Windchill/PPAP-status —
  reuses the exact tool slugs and connection-guide vendor hints that already
  existed in `client-core`'s `VENDOR_GUIDE_HINTS`, e.g. `teamcenter-pat`).
- **Other** (engineers) — untouched. The taxonomies were already
  extremely deep here (~250/~60 roles); the signal is "don't neglect it,"
  not "add more."
- Questionnaire graphs (`tech.v1.ts`, `manufacturing.v1.ts`,
  `generic.v1.ts` — the fallback finance/holding use) gained matching
  `role_cluster`/`weekly_tasks`/`systems` options so these personas are
  actually reachable through the existing deterministic scorer, not just
  data that nothing points at.

Tests: `packages/profiles/test/profiles.test.ts` — two new assertions (every
profile seeds a beachhead `senior_manager` with a matching package;
`marketTier` is always one of the three tiers where set) plus the existing
package-count assertion updated (20→22 manufacturing, 7→9 tech).
`packages/questionnaire`'s determinism/graph-validation suite passes
unchanged — these are pure data additions to graphs already exercised by
that suite.

## Part 2 — the installation wizard's four steps, and a real constraint

Steps 1–2a (job function, pre-defined multiple-choice tasks) are exactly
what `@arm/questionnaire` already does — Part 1 above extends that, no new
mechanism needed.

Steps 2b (AI-parsed free-text pain points), 3 (folder scan → file-type
inference), and 4 (installed-plugin scan) all hit **A5 / Invariant 1**
head-on: `@arm/questionnaire` is a pure, deterministic, no-LLM-reachable
package by design (`questionnaire-determinism` guardrail) specifically so a
recommendation is auditable — "same answers + same catalog index ⇒
byte-identical output, forever." And Invariant 1 (§11.1 of the spec):
**prompt bodies + resource content never leave the tenant VPC** — the
control plane is metadata + audit only. Free text, file contents, and a
laptop's installed-app inventory are all "content" in that sense.

The reconciling design (not yet built, next slice): none of steps 2b/3/4 can
run in the hosted `apps/onboarding` web app, because that's cross-tenant
SaaS surface — exactly what Invariant 1 says content must never reach. They
have to run **client-side**, after the base package is already installed
(the existing `arm setup` bootstraps a minimal runtime first), as a
refinement pass:

1. Free text is parsed **locally** into structured tags — never transmitted
   or stored raw. Only the derived tags cross into `packages/questionnaire`'s
   scorer, which stays exactly as pure/deterministic as it is today, because
   by the time anything reaches it, it's already a structured answer, same
   shape as a multiple-choice pick.
2. Folder scan reads **extensions only, never file contents or names** — a
   deterministic (no LLM needed) extension→tag lookup table. This directly
   touches Open Item #4 (§13 of the spec: "scope of 'files' resource... only
   classification tag crossover applies. Confirm with InfoSec") — worth
   flagging explicitly rather than treating as already settled.
3. Plugin scan reads **known install paths/registries only** — a static
   app-id→component lookup, also deterministic, also local-only.

This is also the natural home for the "embedded sub-agent" from the earlier
design discussion (dynamic MCP install, connections wizard) — one local,
post-install refinement flow, not three unrelated features.

## Next slice

`packages/client-core`: `folder-scan.ts`, `plugin-scan.ts` (deterministic,
metadata-only, unit-testable with no LLM/DB), `pain-points.ts` (local
keyword-based classifier v1 — documented as upgradeable to a tenant-routed
model later, never a network call today). Then wire into `arm setup` as an
optional post-install refinement step, and a control-plane procedure that
takes the resulting structured tags and extends the existing
`requestAssignment`/approval flow (A6) — reusing machinery, not inventing a
parallel one.
