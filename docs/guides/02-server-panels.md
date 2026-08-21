---
title: "Guide 02 — Server side: management panels"
date: 2026-08-21
status: proposed
owner_agent: server
---

# Guide 02 — Management Panels

**Mission.** Re-point the control-plane dashboard at the primary value prop. Today
it answers "what did AI cost us?" It must answer "how much of the company is
actually using agents, where is adoption stalling, and what is blocking it?" — with
cost as the secondary story and on-prem model mix as a tracked-not-targeted detail.

**Prerequisite:** guide 00 landed (routers, event tables, contracts frozen).

**You own:** `apps/control-plane/web/**`, `apps/control-plane/workers/**`,
`packages/trpc/src/adoption-router.ts`, and the marked router-registration block in
`packages/trpc/src/index.ts`.

**You do not own** `library-router.ts` or `onboarding-router.ts`. Build `/library`
and `/rollout` against the placeholder routers from guide 00 — they return typed
empty fixtures, which is exactly what you need for loading/empty states.

---

## 1. Information architecture

Replace `NAV_SECTIONS` in `apps/control-plane/web/src/components/sidebar.tsx`:

```
Adoption    /              role home (re-laid-out)
            /adoption      activation funnel, stalls, time-to-value, coverage, gaps
            /rollout       questionnaire designer, campaigns, download links, codes
Library     /library       search + facets over packages and components
            /library/[slug] component or package detail
            /assignments   org tree × package matrix              (existing, keep)
Governance  /governance /access /resources /idp /audit /organization   (existing)
Cost        /spend /savings                                        (moved down)
Admin       /admin/roles /provisioning /agents                     (existing)
```

Changes to existing routes:

- `/` role home: top row is adoption + approvals; spend becomes a single strip, not
  the headline. Each persona keeps its own home (spec §5.3) — exec and admin land on
  adoption, InfoSec still lands on audit.
- `/spend` keeps all content, loses its Platform-level position. Reframe the primary
  chart from "closed vs self-hosted" to **cost per active seat** and **cost per work
  product**; keep the closed-vs-open split as a secondary panel (A1: on-prem is
  nice-to-have, so it is reported, not campaigned for).
- `$/work-product` dashboards move from `/spend` to `/governance`.
- `/catalog` is retired; its route redirects to `/library`. Delete
  `src/lib/catalog-mock.ts` once `/library` reads the real router.

---

## 2. `/adoption` — the primary panel

The funnel, filterable by department / job function / package / date range:

```
eligible → invited → questionnaire completed → token issued → downloaded
→ installed → runtime ready → connections completed → first metered call
→ weekly active
```

Panels:

| Panel | Form | Notes |
|---|---|---|
| Funnel | horizontal stepped bar, absolute counts + conversion % between steps | the hero panel; clicking a step filters the table below |
| Stall breakdown | ranked horizontal bars of `step × error_code` | plain-language labels ("38 stalled connecting Jira"), not raw codes |
| Time-to-value | histogram of questionnaire-start → first-metered-call, p50/p90 markers | target line at 10 min |
| Coverage | matrix: job function (rows) × published-package / activated-seats (cols) | headcount-weighted, sorted by uncovered weight |
| Gaps | ranked list from `library.gaps` | each row links to `/library` prefiltered |
| Recent activations | TanStack table, live | pseudonymous `user_ref`, never an email |

Chart rules (design system is already pinned: Tailwind v4 + Recharts):

- Reuse the existing CSS custom properties (`--navy`, `--warning`, `--text-primary`,
  `--border`, …). Do not introduce a second palette.
- Series colours must stay distinguishable in light and dark and pass 3:1 against
  the panel background; never encode meaning by colour alone — pair with label or
  shape.
- Every panel gets the **deferred-shell treatment** already in CONCEPTS.md:
  footprint-matched skeleton, explicit empty and error states, stale-data badge when
  ledger freshness exceeds threshold. The grid must never shift.
- Funnels and histograms get accessible tabular fallbacks (`<table>` visually hidden)
  for screen readers — WCAG 2.1 AA is a stated procurement requirement.

---

## 3. `/rollout` — the admin side of adoption

- **Questionnaire designer**: list/edit/publish `questionnaire_definition` versions
  (graph editing is a form over the node list, not a visual graph editor — keep it
  boring). Publishing bumps `version`; definitions are immutable once published.
- **Campaigns**: create an invite batch for an org node; produces a shareable
  `/start` link, per-user activation codes, and a CSV export for IT.
- **Download artifacts**: current installer versions per platform, with SHA256s and
  the MDM package links the `client` module publishes.
- **Live campaign funnel**: the `/adoption` funnel scoped to one campaign.

Everything here calls `onboarding.*`. Until the `client` agent lands, those return
empty fixtures — build the empty states properly, they are half the work anyway.

---

## 4. `/library` — the browse surface

Search box + facet rail (kind, job function, data classification, mode, source) +
result grid. Two tabs: **Packages** (role bundles, the app-store view that
`/catalog` prototyped) and **Components** (MCPs, skills, plugins, templates).
Third tab **Discovery** for admins: candidate queue with promote/reject.

Reuse the card layout from the existing `/catalog` page, then delete that page. Wire
the Request button to `catalog.requestAssignment` — it is currently visual-only with
a `TODO`, and this is the PR that fixes it.

Component detail shows: versions with digests (truncated, copy-on-click), job
functions, which packages include it, install count, review status, provenance for
imported components.

---

## 5. Data path — `packages/trpc/src/adoption-router.ts`

All `tenantProcedure`. Every query takes the existing optional `scope` input so the
org-tree drill-down works exactly like the other routers.

| Procedure | Returns |
|---|---|
| `funnel` | `{ steps: [{ step, count, conversionFromPrev }], filters }` |
| `stalls` | `{ rows: [{ step, errorCode, label, count, share }] }` |
| `timeToValue` | `{ buckets: [{ ltMinutes, count }], p50, p90 }` |
| `coverage` | `{ rows: [{ jobFunctionKey, name, headcountWeight, packages, activatedSeats, eligibleSeats }] }` |
| `activeUsers` | `{ weeklyActive, activatedSeats, eligibleSeats, trend: [...] }` |
| `recentActivations` | paginated activation events |

### 5.1 Fixture mode and real reads

Introduce `ARM_FIXTURE_MODE` (default `1`). The router reads fixtures when set and
ClickHouse when not. This is what keeps you unblocked while the `client` module is
still being built — and it is also how `/demo` runs (guide 04).

Real reads go through a new `packages/clickhouse` query module. Read models:

```sql
-- funnel: one row per (step) with distinct users, honouring scope + date range
SELECT step, uniqExact(user_ref) AS c
FROM activation_event
WHERE tenant_id = {t} AND ts BETWEEN {from} AND {to} AND outcome = 'ok'
GROUP BY step;

-- time to value: per user, min(questionnaire_started) → min(first_metered_call)
```

Add a `apps/control-plane/workers` job `adoptionRollupJob` that materializes daily
per-(tenant, org_node, job_function) counts into a rollup table so the panels do not
scan raw events at page load. Follow the existing worker job pattern
(`DailyUsagePullJob` etc. — currently skeletons; yours should be a real
implementation).

Fixtures must be realistic, not flattering: include stalls, abandonment, and a
long tail. Generate them from `apps/simulation` where you can, and label them as
fixtures in the UI when `ARM_FIXTURE_MODE=1` (a small "sample data" badge in the
header — the `site` agent depends on this badge existing for `/demo`).

---

## 6. Wiring the real database

`docs/implementation-audit.md` still lists Postgres/ClickHouse wiring as 🔴 and
realtime as 🔴. Adoption metrics are the product's report card, so at minimum:

1. Real ClickHouse client wired for the adoption + spend read paths behind
   `ARM_FIXTURE_MODE=0`, with the connection health surfaced on `/health`.
2. Stale-data badges driven by actual ledger freshness, not a constant.
3. SSE/tRPC subscription for `funnel` + `recentActivations` only (the two live
   panels); everything else stays SSR + revalidate. Do not attempt realtime
   everywhere — spec §5.3 says ledger-fed views only.

Update the implementation-audit scorecard rows you turn green.

---

## 7. Tests

- Component tests (vitest) for every new panel: loading, empty, error, populated.
- Router tests for all six adoption procedures, including scope drill-down and
  cross-tenant isolation (a fixture from another tenant must not leak — mirror the
  existing tenant-middleware tests).
- Playwright e2e, added to the existing suite: land on `/adoption` → filter by
  department → drill into a stall → navigate to `/library` prefiltered by the gap.
- Visual-regression snapshot on the dashboard shells (the suite already does this
  for existing shells).
- Accessibility: axe pass on `/adoption`, `/rollout`, `/library`.

---

## 8. Acceptance criteria

- [ ] Sidebar IA matches §1; `/catalog` redirects to `/library`; `catalog-mock.ts` deleted.
- [ ] `/adoption` renders all six panels with real deferred-shell states and passes axe.
- [ ] `/rollout` renders against the placeholder onboarding router without errors.
- [ ] `/library` reads `library.search`/`facets`; Request button calls `catalog.requestAssignment` for real.
- [ ] `adoption-router` implements all six procedures in both fixture and ClickHouse modes.
- [ ] `adoptionRollupJob` implemented and tested.
- [ ] `/spend` reframed to cost-per-active-seat and cost-per-work-product; closed-vs-open demoted to a secondary panel.
- [ ] `pnpm typecheck && pnpm test && pnpm e2e && pnpm guardrails` green.

## 9. Out of scope

The questionnaire engine itself, setup tokens, installers (guide 03); the artifactory
and discovery internals (guide 01); the marketing site (guide 04). Do not add a new
charting library or design system.

## 10. Docs to update

`docs/arm-spec.md` §5.3 (new IA), §9/1.y (adoption success criteria — copy the table
from the restructure plan §8), §12 (adoption risk row is now the thesis);
`docs/wireframes.md` (`/adoption`, `/rollout`, `/library`);
`docs/implementation-audit.md` (rows you turned green); `README.md` route table.
