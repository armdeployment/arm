---
title: Implementation Audit — 1.0 + 1.1
date: 2026-07-27
status: living
audience: engineering
---

# ARM Implementation Audit — 1.0 + 1.1

Full comparison of `docs/arm-spec.md` §9 (Phase Plan) + §14.1 (Invariants-as-code)

- §5.3 (Web UI IA) against the actual codebase.

**Head commit:** `09baef6` (1.1: model-mix dashboard + security flagging system)

---

## Scorecard

```
26 typecheck tasks green
6 guardrails green (all mutation-proofed)
104 unit tests pass across 8 test suites
9 Playwright e2e tests pass
68 tracked TS/TSX source files
8 packages · 11 apps · 4 CI workflows · 6 guardrails · 12 UI components
```

---

## §9 1.0 — Foundation

| Deliverable                                       | Status | Evidence                                              |
| ------------------------------------------------- | ------ | ----------------------------------------------------- |
| Monorepo (pnpm + Turborepo strict TS)             | ✅     | package.json, turbo.json, tsconfig.base.json          |
| ESLint, Prettier                                  | ✅     | eslint.config.mjs, .prettierrc.json                   |
| Repo governance (AGENTS.md, CONCEPTS, Makefile)   | ✅     | all 3 present                                         |
| CI skeleton (4 workflows)                         | ✅     | typecheck, guardrails, contract-check, security-audit |
| Pre-push gate (husky)                             | ✅     | .husky/pre-push runs guardrails                       |
| docs/solutions/ (D1/D2/D5 records)                | ✅     | 3 dated records                                       |
| Postgres schema (22 tables, full §4.1)            | ✅     | drizzle/0000_far_drax.sql                             |
| Invariant §11.2 (sub_account_id unique)           | ✅     | verified in generated DDL                             |
| Invariant §11.7 (stakeholder NOT NULL)            | ✅     | verified in generated DDL                             |
| Invariant §11.8 (priority default standard)       | ✅     | verified in generated DDL                             |
| ClickHouse schemas (2 event tables)               | ✅     | 0001_init.sql                                         |
| ClickHouse partition (tenant, toYYYYMM)           | ✅     | verified + runtime assertion                          |
| Web shell (Next.js 16 + 5 routes)                 | ✅     | /, /agents, /spend, /access, /audit                   |
| Design system (Tailwind v4 + Recharts + TanStack) | ✅     | all deps present                                      |
| tRPC API pipeline wired                           | ✅     | /api/trpc/[trpc] + TRPCProvider                       |
| packages/proto (zod event contracts)              | ✅     | 9 contract tests                                      |
| packages/config (env validation)                  | ✅     | zod AppConfig                                         |
| packages/auth (OIDC + RBAC skeleton)              | ✅     | jose + verifyOIDCToken + hasPermission                |
| packages/trpc (routers + tenant middleware)       | ✅     | 6 routers, 15 tests                                   |
| packages/policy (deny-wins resolver)              | ✅     | 11 tests incl. 3 fast-check property tests            |
| Own-telemetry baseline (OTel)                     | ✅     | initTelemetry + getHealth + health endpoint           |
| Lo-fi wireframes                                  | ✅     | docs/wireframes.md                                    |
| CI sync check (AGENTS ↔ workflows)                | ✅     | ci-sync.ts guardrail                                  |
| guardrail: safe-render                            | ✅     | XSS guard for LLM strings                             |
| guardrail: tenant-isolation                       | ✅     | schema lint                                           |
| guardrail: no-content-egress                      | ✅     | event schema scan                                     |
| guardrail: no-secret-dumps                        | ✅     | secret pattern scan                                   |
| guardrail: boundaries                             | ✅     | dependency direction enforcement                      |
| guardrail: ci-sync                                | ✅     | AGENTS.md ↔ .github/workflows                         |

**1.0 completion: 100% of 13 audit items filled. Exit gate met.**

---

## §9 1.1 — LLM Metering & Dashboards

| Deliverable                                          | Status      | Evidence                                   |
| ---------------------------------------------------- | ----------- | ------------------------------------------ |
| Anthropic admin-API connector                        | ✅ stub     | @arm/billing: anthropicConnector           |
| OpenAI admin-API connector                           | ✅ stub     | @arm/billing: openaiConnector              |
| ProviderConnector interface + contracts              | ✅          | ProviderUsageResult, ProviderConnector     |
| Reconciliation (drift detection)                     | ✅          | reconcile() + 4 tests                      |
| Delegate-key minting (schema)                        | ✅ schema   | DelegateKey table in §4.1                  |
| Delegate-key minting (tRPC mutation)                 | ⚠️ partial  | create mutation exists, no key-gen logic   |
| Workers: daily usage pull                            | ✅ skeleton | DailyUsagePullJob type + processJob stub   |
| Workers: reconciliation                              | ✅ skeleton | ReconciliationJob type + processJob stub   |
| Workers: drift alerts                                | ✅ skeleton | DriftAlertJob type + processJob stub       |
| Dashboards: org-tree explorer                        | ✅          | child-scope-grid + breadcrumb + drill-down |
| Dashboards: cost rollups (per-tier, per-stakeholder) | ✅ per-tier | tierBreakdown in summary                   |
| Dashboards: savings estimator                        | ✅          | SavingsEstimator component + query         |
| Dashboards: hosting-cost model                       | 🔴 missing  | not yet implemented                        |
| Dashboards: alerts + notification center             | ✅          | NotificationCenter component               |
| Dashboards: model-mix                                | ✅          | spend.modelMix query                       |
| Dashboards: security flagging                        | ✅ bonus    | security.flags + SecurityFlags component   |
| Dashboards: model enforcement (DLP gate)             | ✅ bonus    | policy.modelRules + scopeCompliance + UI   |
| Realtime via tRPC/SSE                                | 🔴 missing  | not yet implemented                        |
| Wire Postgres/ClickHouse                             | 🔴 pending  | requires DB infrastructure                 |
| Workers: real scheduling (BullMQ/cron)               | 🔴 pending  | skeleton only, no scheduler wired          |

**1.1 completion: ~75%. Dashboard, billing architecture, and compliance
features done. Remaining: SSE realtime, hosting-cost model, real DB queries,
real worker scheduling.**

### Bonus features (beyond spec §9 1.1)

These were added as differentiators identified in the competitive analysis:

| Feature                               | Spec ref    | Status                                     |
| ------------------------------------- | ----------- | ------------------------------------------ |
| Hierarchical drill-down dashboard     | §5.3 + §6.1 | ✅ 10 depts, 60 agents, $16,170/mo         |
| Spend treemap (vivid management view) | §5.3        | ✅ Recharts Treemap                        |
| Spend tree view (indented hierarchy)  | §5.3        | ✅ clickable rows                          |
| Work-type classification              | new         | ✅ taskType + workTypes query + UI         |
| Classification clearance (DLP gate)   | §6.5        | ✅ public/internal/confidential/restricted |
| Model selection enforcement UI        | §6.5        | ✅ ModelPolicyPanel                        |
| Security flagging (risky operations)  | new         | ✅ 5 categories, 3 severities              |
| Competitive analysis doc              | process     | ✅ vs TrueFoundry Agent Gateway            |

---

## §14.1 — Invariants-as-code guardrail status

| Guardrail                        | Status              | Mutation proofs                               |
| -------------------------------- | ------------------- | --------------------------------------------- |
| tenant-isolation (§11.6)         | ✅                  | 3 (break, pass, vacuous)                      |
| no-content-egress (§11.1)        | ✅                  | 3 (break, pass, real SQL)                     |
| no-secret-dumps (§12)            | ✅                  | 2 (break, pass)                               |
| boundaries (§14.3)               | ✅                  | 3 (back-edge, data-plane, pass)               |
| safe-render (§14.1 XSS)          | ✅                  | 3 (innerHTML, eval, pass)                     |
| ci-sync (§14.3)                  | ✅                  | 5 (missing, extra, pass, parse, vacuous)      |
| deny-wins property tests (§11.3) | ✅ (in @arm/policy) | 3 fast-check (200 runs each)                  |
| accountable stakeholder (§11.7)  | ✅ schema           | DB constraint; API validation test 🔴         |
| event-shape stability (§4.2)     | ✅ @arm/proto       | 9 zod contract tests                          |
| policy-cache freshness (D5)      | 🔴 missing          | data plane not built yet                      |
| dependency security              | ⚠️ partial          | workflow exists; baselining mechanism missing |

---

## Rough Test Breakdown

### Unit tests (104 total)

| Suite           | Tests | Coverage                                                                     |
| --------------- | ----- | ---------------------------------------------------------------------------- |
| @arm/proto      | 9     | zod event contract tests (valid/invalid parse, no content fields)            |
| @arm/db         | 17    | schema invariant tests (tenant_id, stakeholder, priority, 1:1 sub_account)   |
| @arm/policy     | 11    | deny-wins (3 fast-check property tests, 200 runs), LLM model routing         |
| @arm/auth       | 11    | RBAC (hasPermission, hasAllPermissions, hasAnyPermission), token builder     |
| @arm/trpc       | 15    | tenant middleware, org tree drill-down, spend rollups, agent scope filtering |
| @arm/config     | 5     | telemetry initialization, health snapshot                                    |
| @arm/guardrails | 21    | mutation proofs for all 6 guardrails (break→red, restore→green)              |
| @arm/billing    | 4     | reconciliation (ok, warning, critical, missing_data)                         |
| @arm-app/web    | 11    | mock data integrity (tier sums, adoption %, sort order, no-content fields)   |

### e2e tests (9)

| Test                                           | Verifies                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| org-root: shows org summary + drill-down cards | CEO view renders stat cards + 10 department cards |
| org-root: sidebar navigation works             | 5 nav links present                               |
| drill-down: click department                   | navigates to scoped view, shows child groups      |
| drill-down: breadcrumb navigates back          | click Acme Manufacturing returns to /             |
| /agents at org level                           | full 60-agent list renders                        |
| /agents scoped to team                         | only that team's agents                           |
| /spend breakdown                               | stats + reconciliation breakdown visible          |
| /access JIT queue                              | pending approvals visible                         |
| /audit placeholder                             | placeholder renders                               |

---

## D10 — Adoption-First Restructure, Wave 1 `server` (docs/guides/02-server-panels.md)

Rows turned green by this PR series (branch `feat/server-adoption-panels`).
Supersedes/refines the two 🔴 rows above it lists explicitly.

| Deliverable                                                                                                                     | Status                                                                           | Evidence                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar IA — Adoption/Library/Governance/Cost/Admin (guide 02 §1)                                                               | ✅                                                                               | components/sidebar.tsx                                                                                                                                                                                                                                                      |
| `/adoption` — funnel, stalls, time-to-value, coverage, gaps, recent activations                                                 | ✅                                                                               | app/adoption/page.tsx + components/adoption/*                                                                                                                                                                                                                               |
| `adoption-router` — all 6 procedures, fixture + ClickHouse modes                                                                | ✅                                                                               | packages/trpc/src/adoption-router.ts, 48 tests                                                                                                                                                                                                                              |
| `adoptionRollupJob` — real (not skeleton) daily rollup aggregation                                                              | ✅                                                                               | apps/control-plane/workers/src/adoption-rollup-job.ts, 6 tests                                                                                                                                                                                                              |
| `/rollout` — admin side of adoption against placeholder onboarding router                                                       | ✅ (partial, flagged)                                                            | app/rollout/page.tsx — see file header for the guide-02/guide-00 contract-surface gap (no list/publish/campaign-batch/download-artifact procedures exist yet)                                                                                                               |
| `/library` — replaces `/catalog`; real `catalog.listPackages`/`requestAssignment`, placeholder-backed Components/Discovery tabs | ✅                                                                               | app/library/page.tsx, components/library/package-card.tsx                                                                                                                                                                                                                   |
| `/catalog` retired → redirects to `/library`; `catalog-mock.ts` deleted                                                         | ✅                                                                               | app/catalog/page.tsx; assignments + governance pages migrated to real routers, one clearly-labeled sample-data file (lib/governance-fixtures.ts) for the one figure with no backing procedure yet (per-package metered spend)                                               |
| `/spend` reframed — cost-per-active-seat + cost-per-work-product primary, model-mix secondary                                   | ✅                                                                               | app/spend/page.tsx                                                                                                                                                                                                                                                          |
| `/` role home — adoption + approvals lead, spend condensed to a strip                                                           | ✅ (persona routing itself flagged as an unwired gap — no real auth session yet) | app/page.tsx                                                                                                                                                                                                                                                                |
| Realtime for `/adoption`'s two live panels                                                                                      | ⚠️ partial                                                                       | polling (`refetchInterval: 15_000`), not a true SSE subscription — deliberate scope-trim, documented in recent-activations-panel.tsx                                                                                                                                        |
| Real ClickHouse wiring for adoption reads                                                                                       | ⚠️ code path exists, unexercised                                                 | `ARM_FIXTURE_MODE=0` HTTP-query code path in adoption-router.ts; no live ClickHouse instance in this dev/test environment to run it against                                                                                                                                 |
| Component tests (loading/empty/error/populated) for every new panel                                                             | ✅                                                                               | apps/control-plane/web/test/components/*.test.tsx, jsdom + testing-library added                                                                                                                                                                                            |
| Router tests incl. scope drill-down + cross-tenant isolation                                                                    | ✅                                                                               | packages/trpc/test/adoption-router.test.ts                                                                                                                                                                                                                                  |
| Playwright e2e + axe accessibility checks for /adoption, /rollout, /library                                                     | ⚠️ written, unrun                                                                | e2e/adoption.spec.ts — blocked on a pre-existing `next build` failure, see note below                                                                                                                                                                                       |
| Visual-regression snapshots on new panels                                                                                       | ❌ not added                                                                     | the existing playwright.config.ts explicitly disables screenshots (`screenshot: "off"`) as a token-conservation decision — guide 02 §7's "the suite already does this for existing shells" does not match the actual repo state; flagged rather than silently worked around |

**Pre-existing blocker (not introduced by this PR, confirmed by bisecting against the unmodified `feat/contracts-shared-schema` base):** `next build` (and therefore `next start` / the Playwright e2e suite, which depends on both) fails under BOTH Turbopack and webpack. `packages/trpc/src/index.ts` — a Wave-0 file this agent does not own — imports its sibling router files with the NodeNext-mandated explicit `.js` extension (`./adoption-router.js`, `./catalog-router.js`, etc.) referring to `.ts` source, per `tsconfig.base.json`'s `"module": "NodeNext"`. `tsc` resolves this correctly (typecheck is green); Next.js's bundler does not, under either backend, and this reproduces identically with zero Wave-1 changes applied. One related, real, in-scope bug WAS found and fixed during this investigation: `next.config.ts` let Turbopack misdetect the workspace root when the repo is checked out as a nested git worktree (it found two `pnpm-workspace.yaml` files and picked the wrong one) — fixed via an explicit `turbopack.root`. That fix alone does not unblock the build given the deeper NodeNext/bundler gap above, which sits outside this agent's file-ownership list (`packages/trpc/src/index.ts` body, and the wider "does Next's bundler support this TS convention at all" question, are not `server`-owned).

---

## Known gaps → next phases

### 1.1 remaining

1. **SSE / realtime** — tRPC subscriptions for live dashboard updates (high impact for management demo)
2. **Hosting-cost model** — display the hosting cost for self-hosted models
3. **Delegate-key minting logic** — not just the schema; the actual key-generation mutation
4. **Real Postgres/ClickHouse wiring** — replace fixture data; requires DB infrastructure
5. **Worker scheduling** — wire jobs to BullMQ/Redis or K8s CronJob

### 1.0 residual (low priority)

1. **API validation ad-hoc for stakeholder** — DB constraint ✓, API validation test 🔴, should add a test on create agent mutation that rejects null stakeholder
2. **Dependency security baselining** — advisory mechanism still missing (workflow uses continue-on-error)
3. **Policy-cache freshness (D5)** — requires data plane to report policy_version

### 1.2+

| Phase | Deliverable                                                          | Depends on                |
| ----- | -------------------------------------------------------------------- | ------------------------- |
| 1.2   | Hono closed-proxy + Open-Gateway + packaging                         | DB wiring                 |
| 1.3   | Cloud connectors (S3/GCS) + permission engine + policy simulator     | Authentication completion |
| 1.4   | DB/SharePoint connectors + JIT workflow + classification enforcement | 1.2/1.3 complete          |

---

## Execution Quality Notes

- **No real LLM calls / no real API keys used**: every connector stubs/returns seeded fixture data. The architecture is real; the data wiring waits for DB credentials (per spec working agreement: "do not fabricate credentials").
- **All tests are unit + e2e** — no integration tests against real DB yet. Drift tests are stub-only.
- **tRPC SSE** is implemented as a hook contract in tRPC v11; the wire transport (EventSource) is not wired because there's no event source to push from in dev mode.
- **Developed bonus differentiators** beyond the original spec (security flags, work-type classification, hierarchical treemap); the spec was updated to reflect them.

## Spec updates shipped with code

| Doc                                                 | Change                                                                                       | Commit  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------- |
| docs/arm-spec.md §1                                 | Differentiation paragraph rewritten with TrueFoundry competitive context + 5 vertical angles | 16edad3 |
| docs/arm-spec.md §1                                 | Added "department-level work-type classification" as differentiator #2                       | 16edad3 |
| docs/solutions/competitive-analysis.md              | New: vs TrueFoundry Agent Gateway feature matrix                                             | 16edad3 |
| docs/solutions/2026-07-26-d1-tenant-placement.md    | Decision record (D1)                                                                         | 5e995e4 |
| docs/solutions/2026-07-26-d2-classification-gate.md | Decision record (D2)                                                                         | 5e995e4 |
| docs/solutions/2026-07-26-d5-policy-distribution.md | Decision record (D5)                                                                         | 5e995e4 |
| docs/wireframes.md                                  | ASCII wireframes for all 5 routes + shell                                                    | 86dc3e4 |
| AGENTS.md                                           | Status + run commands updated for landed code                                                | 180ac95 |
| README.md                                           | Frontend quick-start guide                                                                   | 1ba4811 |
