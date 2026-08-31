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
  dashboards + approvals-inbox + web-search, framed around _their_ ARM
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

## Part 3 — the three local scan modules + `arm refine` (shipped this slice)

`packages/client-core` gained three pure/deterministic-where-possible
modules, none of which make a network call or import `@arm/questionnaire`
(client-core stays scoped to `@arm/proto`+`@arm/config`, per the
`boundaries` guardrail):

- `folder-scan.ts` — `scanWorkFolder(path)` reads file **extensions only**
  (never names, never content) up to a bounded depth/file count, maps the
  extension histogram to tags (`cad_heavy`, `code_heavy`, ...) via a static
  table, threshold-filtered so one stray file isn't a signal. Only
  `extensionCounts`/paths are local-only detail; `tags` is what's meant to
  be shared.
- `plugin-scan.ts` — `scanInstalledTools()` checks for the _presence_ of
  known per-platform install paths (Teamcenter, Windchill, SolidWorks,
  MATLAB, STAR-CCM+, VS Code, Docker, Slack, ...) — never opens or reads
  them. `pathExists` is injectable so tests never touch a real filesystem.
- `pain-points.ts` — `classifyPainPoints(text)`, a local deterministic
  keyword classifier (not an LLM call — every match is auditable by
  construction: "why did I get tagged X" always has a one-line keyword
  answer). Callers must never log/store/transmit the raw `text` argument,
  only this function's return value.

`arm refine` (new CLI command, `apps/cli/src/index.ts`) wires all three
into an optional, skippable post-`arm setup` step: interactive (prompts for
pain points + a folder, empty answer skips either) or non-interactive
(`--pain-points "..."`/`--folder <path>`), installed-tools scan always runs.
`printRefineSummary` prints only derived tags — never the raw text or any
file path/name — with an explicit "nothing above this summary left your
machine" banner.

**Real bug found by smoke-testing the interactive path, not by the unit
tests**: `rl.question()` (used by `arm setup`'s existing single-prompt
`defaultPrompt`) attaches its 'line' listener only once awaited. That's
fine for one question on a real TTY (input arrives after the prompt), but
`arm refine` asks two questions in sequence, and piped/non-TTY stdin with
both answers already buffered (a scripted or CI invocation) can deliver the
second line before the second `question()` call attaches its listener —
silently dropped, hangs forever, no error. Fixed by driving one shared
readline interface's async iterator directly (`for`-`await`-style
`.next()` pulls) instead of two sequential `question()` calls — pulling a
line on demand has no such race whether it was already buffered or arrives
later. Verified against the exact repro (`printf "\n\n" | arm refine`
hanging past a 10s timeout, vs. completing immediately after the fix).

Tests: 22 new `@arm/client-core` unit tests (real temp dirs for the folder
scan, an injected fake filesystem for the plugin scan, pure input/output
checks for the classifier) + 10 new `@arm-app/cli` tests (parser +
orchestration, every dependency injected — no real FS/network/TTY). Full
monorepo build (17 packages) and all 19 guardrails pass unchanged.

## Next slice

A control-plane procedure that takes `arm refine`'s structured output and
extends the existing `requestAssignment`/approval flow (A6) so a refinement
can actually add an optional component to an assignment — today `arm
refine` is diagnostic only (prints signals, changes nothing), which the
CLI's own summary says explicitly. Reusing that existing approval machinery
rather than inventing a parallel one is the point; wiring it is what's left.
