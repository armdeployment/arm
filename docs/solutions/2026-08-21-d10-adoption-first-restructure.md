---
title: "Restructure plan: adoption-first value prop, questionnaire provisioning, component library + discovery (D10/D11/D12)"
date: 2026-08-21
status: proposed
supersedes: none
---

# ARM Restructure Plan — Adoption First

Planning document only. **No code changes are proposed for execution here** — this
is the change surface to agree on before anything is implemented, per the Spec
Travel Rule (§14.3).

Three decisions came in:

| | Decision |
|---|---|
| **Value prop** | (1) agent adoption at scale in the corporate, (2) cost saving, (3) on-prem LLM (nice-to-have) |
| **Deliverables** | Server side: management panels · Client side: custom downloader driven by a questionnaire · Library: plugins/MCPs/skills per job function, with discovery |

The short version: **ARM already has most of the machinery, but it is ordered
around the wrong headline.** The repo is built cost-and-governance-first with the
adoption work (D9 Work Packages, `arm setup`, client-core) sitting at the *end* of
the phase plan (1.5–1.7, still PROPOSED). The three decisions invert that order.
Two of the three deliverables exist in skeleton form; the third (library +
discovery) is the largest genuinely new build.

---

## 1. What exists today

**Shape.** pnpm + Turborepo TypeScript monorepo. 6 apps, 13 packages, 4 CI
workflows, 6–7 mutation-proofed guardrails, ~22 Postgres tables + 2 ClickHouse
event tables. `docs/arm-spec.md` v0.6 is the source of truth.

```
apps/       arm-video  cli  control-plane{api,web,workers}  data-plane{connectors,
            meter-agent,open-gateway,plugin-ingest,proxy}  public(EMPTY)  simulation
packages/   agent-sdk auth billing catalog classifier clickhouse client-core
            config db policy profiles proto trpc
```

**Server side — management panels.** `apps/control-plane/web`, Next.js 16 +
tRPC + Tailwind/shadcn, 13 routes in 4 sidebar sections (Platform / Governance /
Work Packages / Admin): `/`, `/agents`, `/spend`, `/organization`, `/access`,
`/resources`, `/idp`, `/audit`, `/catalog`, `/assignments`, `/governance`,
`/admin/roles`, `/provisioning`. Everything runs on **fixture data through the
real tRPC pipeline** — Postgres/ClickHouse are not yet wired (per
`docs/implementation-audit.md`), and realtime/SSE is missing.

**Client side.** `packages/client-core` is the shared engine (manifest fetch →
sha256 integrity verify → opencode config render with env-var-only credentials →
metered round-trip verify), driven by `apps/cli`'s `arm setup --role <roleKey>
--tenant-url … --agent-token …`. It works, but it assumes the employee already
knows their role key and holds a token. `apps/desktop` from the roadmap **does not
exist**; there is no GUI, no installer, no MDM packaging.

**Library.** `packages/db/src/schema/catalog.ts` + `packages/catalog` +
`packages/trpc/catalog-router.ts` give a real Tool Registry and versioned Work
Packages: `tool`, `tool_version`, `work_package`, `work_package_version`,
`package_assignment`, `budget_reservation`, with content-addressed manifest
hashing and an assignment state machine. `packages/profiles` seeds 4 industry
profiles. `/catalog` renders an app-store-ish card grid — from a static mock, with
a visual-only Request button.

**Value prop as written.** Spec §1 leads with hierarchical org-tree budgeting and
lists six differentiators; Work Packages are #6. §1.1 problem statement #1 is
management visibility, #2 is steering spend to self-hosted open models. Phase plan
runs 1.0 foundation → 1.1 metering dashboards → 1.2 closed-proxy + **open-gateway**
→ 1.3/1.4 resource connectors → 1.5/1.6/1.7 work packages. Success criteria are
metering share and `$/work-product`.

---

## 2. Where the decisions collide with what's there

| Decision | Collision |
|---|---|
| Adoption is primary | Adoption work is last in the phase plan; there is **no adoption metric and no adoption panel anywhere** in the product. §12 already carries an "agent adoption failure" risk row — under the new value prop that is no longer a risk, it is the thesis. |
| Cost saving secondary | Cost is currently the loudest surface (`/spend` as a Platform-level route, savings estimator, GPU brokering, hosting-cost model, "closed vs self-hosted" as the framing). Needs demotion, not deletion. |
| On-prem LLM nice-to-have | `apps/data-plane/open-gateway` is described as **backbone** ("self-hosted open gateway + closed-proxy as backbone", §Decisions locked) and problem statement #2 is open-model migration. That is a headline-level claim for something now labelled nice-to-have. |
| Server panels | Exist, but organised around cost/governance and running on fixtures. No adoption funnel, no library browser, no rollout surface. |
| Questionnaire downloader | Conflicts with the roadmap's stated "the client asks exactly two questions" principle (§3.1 of the roadmap). Resolvable — see §5 — but it must be written down, not left as two contradictory docs. |
| Library per job function + discovery | `skills`, `subagent_configs`, `permissions`, `starter_prompts`, `template_refs` are **bare `string[]`** inside the package manifest — no entity, no version, no owner, no review status, no search. "Discovery" in the codebase today means `/.well-known/arm-agent` self-config, **not** package search. Job functions exist only as prose in `docs/research/oem-job-taxonomy.md` (~250 roles / 20 functions). |

One process blocker worth naming first: **D6, D7 and D9 are all still `PROPOSED`,
never signed off.** Everything below builds on D9's schema. Locking those three (or
revising them under the new value prop) is Wave 0 work.

---

## 3. Decision records to write (D10 / D11 / D12)

Following the repo's own convention (`docs/solutions/` dated records, decision
frame + resolution + consequences + guardrails + doc-update obligations):

- **D10 — Adoption-first value proposition.** Re-ranks the differentiators,
  re-sequences the phase plan, redefines the success criteria. The one that
  changes what "done" means.
- **D11 — Questionnaire-driven provisioning + the custom downloader.** Defines the
  question graph, the deterministic answers→packages mapping, the setup token, and
  what "custom" means in "custom downloader".
- **D12 — Component library + discovery.** Promotes skills/plugins/MCPs to
  first-class registry entities, introduces the job-function taxonomy, and defines
  internal + external discovery.

---

## 4. Server side — management panels

### 4.1 Information architecture

The sidebar's top section should answer the primary value prop. It currently
answers the secondary one.

```
Adoption   (NEW, default home for admin/exec)
           /adoption          activation funnel, seats, time-to-first-value, gaps
           /rollout           questionnaire designer, download links, MDM artifacts,
                              activation codes, per-department campaigns
Library    (rework of /catalog)
           /library           packages · components · discovery  (search + facets)
           /library/:id       package detail: components, job functions, budget shape
           /assignments       org tree × package matrix (unchanged)
Governance /governance /access /resources /idp /audit /organization
Cost       /spend /savings    (demoted from Platform; $/work-product moves to
                              /governance)
Admin      /admin/roles /provisioning
```

`/` (role home) is re-laid-out: adoption + approvals first, spend as a strip
rather than the headline.

### 4.2 The adoption panel — the one genuinely new server surface

Funnel, per department / job function / package:

`eligible → invited → questionnaire completed → downloaded → installed → first
metered call → active this week`

plus time-to-first-value distribution, stall-step breakdown ("38 people stopped at
the Jira connection step"), package coverage of job functions, and **gap
detection** (questionnaire answers with no matching package — this is the primary
input to the library roadmap).

This needs telemetry that does not exist. Proposed: a third ClickHouse stream
`activation_event(tenant_id, ts, user_id, org_node_id, job_function_key, step,
outcome, package_version_id, client_version, error_code)` — metadata-only,
partitioned `(tenant_id, toYYYYMM(ts))` like the other two, Invariant 1 intact.

### 4.3 Prerequisite debt

Adoption metrics cannot be fixtures — the funnel is the product's report card. So
wiring Postgres + ClickHouse for real (currently 🔴 in the implementation audit)
moves from "later" to "required for the adoption panel", and realtime/SSE follows.

---

## 5. Client side — the questionnaire downloader

### 5.1 Resolving "custom downloader"

Two readings. Recommendation is explicit, because they diverge architecturally:

- ❌ **Per-user compiled binary.** Breaks code signing/notarization (roadmap §5.3
  calls unsigned binaries fatal to the "very easy" promise), breaks CDN caching,
  and re-signs on every package edit.
- ✅ **One signed generic client + a per-user provisioning payload.** The
  questionnaire produces a short-lived signed **setup token** (Invariant 4) that
  encodes tenant, user, recommended package version(s) and the pre-resolved
  connections manifest. "Custom" is the payload, not the executable. Delivered as a
  one-click download page: platform-detected installer + the token embedded in the
  filename/companion `.armsetup` file, or a 6-character activation code for MDM
  installs.

This also resolves the contradiction with the roadmap's "zero decisions" rule: the
**questionnaire moves to the web, before download; the client still asks zero
questions.** Worth stating in D11 in those words.

### 5.2 New/changed components

| Component | Change |
|---|---|
| `apps/public` (currently **empty**) | Becomes the unauthenticated/tenant-scoped landing + questionnaire + download flow (`/start`). Natural home; no new app needed. |
| `packages/questionnaire` (new) | Declarative question graph (JSON per industry profile — D6 rule: presets set defaults, never gate) + a **pure, deterministic** answers→ranked-packages mapping engine. Zero-LLM on the mapping path, mirroring D7's cascade philosophy, so recommendations are reproducible and auditable. Optional LLM assist confined to free-text "describe your job" → candidate job functions, never to the final mapping. |
| `packages/client-core` | `runSetup` gains a `setupToken` path beside the existing `roleKey` path; new `resolveFromSetupToken()`. The roleKey/flags path stays for power users and CI. |
| `apps/cli` | `arm setup --token <code>`; bare `arm setup` opens the browser flow. |
| `packages/db` | `questionnaire_definition` (tenant-scoped, versioned), `questionnaire_response`, `setup_token` (short-lived, single-use). Responses feed the adoption funnel and the discovery gap list. |
| `packages/trpc` | New `onboarding` router: `getQuestionnaire`, `submitResponse`, `recommend`, `issueSetupToken`, `redeemSetupToken`. |
| `apps/control-plane/web` | `/rollout` — questionnaire designer + campaign links + activation codes. |
| Installers | msi / pkg / deb wrapping the CLI, code-signed + notarized, shipped **before** any GUI. A Desktop GUI (Tauri vs Electron, roadmap open question #4) is deferrable if the web questionnaire carries the UX. |

### 5.3 Two things to decide before building

- **Assignment coupling.** The questionnaire produces an assignment request. Does
  it auto-approve for low-risk packages, or always route to an approver? Auto-
  approve is the adoption-first answer; a per-package `approval_required` flag with
  a tenant default is the compromise.
- **Free-text and Invariant 1.** "Describe what you do all day" is *content*. If
  the questionnaire is served by the SaaS control plane, free-text answers are
  content leaving the tenant boundary. Options: keep free-text tenant-side only,
  hash/structure it client-side before submission, or carve out an explicit
  exception in §11. This needs an InfoSec call, and a guardrail either way.

---

## 6. Library — plugins, MCPs, skills per job function, with discovery

The largest new build. Three parts.

### 6.1 Promote components to first-class entities

Today only `tool` is a registry entity; skills, sub-agents, permissions, starter
prompts and templates are strings in a JSONB blob. A library "containing plugins,
MCPs, skills for each job function" cannot be built on strings — they need
versions, owners, review status, and a search index.

Two options:

- **(a) Generalize:** one `catalog_component` + `component_version` pair with
  `kind ∈ {mcp, plugin, skill, subagent, template, prompt_pack, connector}`;
  `tool` becomes the `kind='mcp'|'connector'` subtype. One search index, one review
  workflow, one integrity path. Costs a migration of the D9 schema that landed on
  2026-08-13.
- **(b) Additive:** parallel `skill`/`skill_version`, `plugin`/`plugin_version`
  tables now, generalize later. Cheaper this week, five near-identical tables and
  a fragmented search index later.

**Recommendation: (a)**, precisely because D9 is still `PROPOSED` and only two
weeks old — this is the cheapest moment it will ever be.

Either way this is a **wire break**: `work_package_version` refs become pinned
`{component_id, version}` instead of bare strings, which changes the hashed field
list in `packages/catalog/src/manifest.ts` (the nine fields), `client-core`'s
`buildCanonicalManifest`, and the golden-vector test — all three in the same PR, as
that file's own comment requires.

### 6.2 Job-function taxonomy

`docs/research/oem-job-taxonomy.md` (~250 job types across 20 functions) exists as
prose. It becomes a `job_function` table (key, family, function, aliases,
profile), seeded per industry profile, with `work_package ↔ job_function` as a
many-to-many. This is the spine that the questionnaire maps onto and that the
library is browsed by — one entity serving both deliverables.

Migration note: `work_package.role_key` / `family` are free text today; they need
to reconcile against the taxonomy, with the pilot-10 packages as the first mapping.

### 6.3 Discovery

Two halves, and they are not the same feature:

**Internal discovery** (ship first): search + facets over the tenant's library —
job function, department, tool, data classification, mode, cost band; "used by
people in your role"; "recommended from your questionnaire"; **gaps** (unmatched
questionnaire answers). Postgres FTS + `pg_trgm` is enough for Phase 1 — resist
adding a search service.

**External discovery** (ship second): source adapters (public MCP registry,
internal git orgs, vendor marketplaces) producing **candidates** in
`review_status: draft`, never auto-published. Supply-chain gates: pinned versions,
endpoint scope review, data-classification assignment, owner assignment — reusing
the existing `tool.review_status` workflow rather than inventing a second one.

New `packages/discovery` (search index, recommenders, source adapters) sits at the
same layer as `catalog`; `packages/catalog` stays registry CRUD/versioning/
integrity. Data-plane apps import neither — boundary rule unchanged, enforced by
`guardrails/boundaries`.

New tRPC `library` router: `search`, `facets`, `recommend`, `gaps`,
`submitCandidate`, `review`.

---

## 7. Cross-cutting changes

### 7.1 Invariants

**None of the eight §11 invariants need to change** — worth stating explicitly in
D10 so nobody assumes a re-positioning loosens them. The only pressure point is
questionnaire free-text vs Invariant 1 (§5.3 above).

### 7.2 New guardrails (mutation-proofed per §14.2)

| Guard | Asserts |
|---|---|
| `component-review` | No package version pins a component whose `review_status ≠ approved`. |
| `questionnaire-determinism` | The answers→packages mapping path is pure; no LLM/network call reachable from it. |
| `no-content-in-activation` | `activation_event` + questionnaire telemetry schemas carry no free-text/content fields (extension of the existing `no-content-egress` guard). |
| `package-integrity` (amend) | Extend to component refs after the wire change. |

### 7.3 Documents to update in the same PR series

- `docs/arm-spec.md` → **v0.7**: §1 (differentiator re-rank), §1.1 (problem
  statements re-ordered; adoption becomes #1), §1.2, §2 (non-technical employee
  persona), §3.4, §4.1 (job_function, component tables, questionnaire tables),
  §4.2 (`activation_event`), §5.1, §5.3 (new IA), new §8.7 (questionnaire → download
  → first value flow), §9 (re-sequence + adoption exit gates), §12 (adoption risk
  row is now the thesis, not a risk), §14.1 (new guardrails), §15 (layout).
- `docs/open-decisions.md`: lock D6/D7/D9; add D10/D11/D12.
- `docs/solutions/2026-08-13-work-package-roadmap.md`: reconcile §3.1 "two
  questions" with the web questionnaire; re-scope §5 (installers before GUI).
- `README.md` + `AGENTS.md`: lead with adoption; update status and repo map.
- `docs/agent-onboarding-guide.md`: rewrite around the questionnaire path; flags
  become the advanced fallback.
- `docs/wireframes.md`: `/adoption`, `/rollout`, `/library`.
- `docs/CONCEPTS.md`: setup token, component, job function, activation funnel,
  discovery candidate.

### 7.4 What gets demoted (not deleted)

`open-gateway`, GPU brokering, hosting-cost modelling and open-model migration
targets stay in the codebase and stay behind feature flags, but leave the Phase 1
critical path and the success criteria. `/spend` keeps its content and loses its
top-level position.

---

## 8. Proposed sequencing

| Wave | Content | Gate |
|---|---|---|
| **0 — docs only** | Lock D6/D7/D9. Write D10/D11/D12. Spec v0.7, README, AGENTS. | Value prop and phase plan agreed on paper before a line changes. |
| **1 — library spine** | `job_function` taxonomy + component/component_version (option a) + manifest wire change + golden vector + `component-review` guard. | Registry can express a skill/plugin/MCP per job function; guardrails green under mutation. |
| **2 — questionnaire + downloader** | `packages/questionnaire`, `apps/public /start`, setup token, client-core token path, CLI `--token`, signed installers, `activation_event`. | A non-technical employee: questionnaire → download → first metered call, unassisted, no flags, no config file. |
| **3 — panels** | `/adoption` funnel + `/rollout` + `/library` search (internal discovery) + real Postgres/ClickHouse wiring. | Management can see the funnel and the gaps on live data. |
| **4 — reach** | External discovery sources + review pipeline; Desktop GUI + MDM; cost panel rework. | — |

### Success criteria to replace the current ones

Adoption-first means the top-line metric changes. Proposed §9/1.y replacement:

| Metric | Target |
|---|---|
| Activated seats / eligible seats (per tenant, 90 days) | primary top-line |
| Time-to-first-value (questionnaire start → first metered call) | < 10 min, unassisted |
| Questionnaire → download → install completion | ≥ 70% |
| Job functions with ≥ 1 published package | ≥ 60% of the tenant's headcount-weighted functions |
| Weekly active agent users / activated seats | ≥ 50% |
| *(secondary)* cost per active seat, `$/work-product` | trending down |
| *(nice-to-have)* share of traffic on self-hosted models | tracked, not targeted |

---

## 9. Open questions — needed before Wave 1

1. **"Custom downloader"** — signed generic binary + per-user setup token (§5.1
   recommendation), or literally a per-user built artifact?
2. **Component schema** — generalize `tool` → `component` with a migration (a), or
   parallel `skill`/`plugin` tables (b)?
3. **Questionnaire free-text vs Invariant 1** — tenant-side only, structured
   before submission, or an explicit §11 carve-out?
4. **Assignment approval** — auto-approve questionnaire recommendations for
   low-risk packages, or always require an approver?
5. **On-prem LLM** — does "nice-to-have" mean pause `open-gateway` work in Phase 1
   (the reading assumed above), or keep building it at lower priority?
6. **External discovery sources** — which first: public MCP registry, internal git
   orgs, vendor marketplaces?
7. **D6/D7/D9** — lock as written, or revise under the new value prop before
   building on them?
8. **Desktop GUI** — accept deferral behind web questionnaire + signed installers,
   or is a GUI required for the pilot?
