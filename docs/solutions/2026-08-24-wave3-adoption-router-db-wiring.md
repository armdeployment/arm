---
title: "Wave 3 DB wiring — adoption-router.ts on real Postgres/ClickHouse"
date: 2026-08-24
status: shipped
supersedes: none
---

# Wave 3 DB Wiring: `adoption-router.ts` → Real ClickHouse

Background: `docs/solutions/2026-08-21-d10-adoption-first-restructure.md` §8's
"Proposed sequencing" table lists Wave 3 as "panels + real Postgres/ClickHouse
wiring." Waves 0–2 (contracts, library spine, questionnaire/downloader) shipped
via `docs/guides/00–04`; Wave 3's UI half (`/adoption`, `/rollout`, `/library`)
shipped with the `server` Wave-1 agent, but every router stayed on
`ARM_FIXTURE_MODE=1` in-memory fixtures — the DB wiring itself was still a
`TODO(1.1)` scattered across the router layer.

This lands the DB-wiring half for **one router** (`adoption-router.ts`, all
six procedures) as a proof of the pattern, rather than attempting all
routers in one pass.

## What shipped

- `infra/compose/docker-compose.dev-db.yml` — standalone local Postgres 16 +
  ClickHouse (not the enterprise simulation, not the data-plane proxy stack —
  see the file's header for why this exists as a third compose file).
- `scripts/dev/apply-clickhouse-migrations.mjs` — applies
  `packages/clickhouse/migrations/*.sql` over ClickHouse's HTTP interface,
  splitting on statement-terminating `;` while correctly ignoring one that
  appears *inside* a `--` comment (`0001_init.sql`'s `work_type` column doc:
  "enforcement-ready; NULL until resolved" — a naive split breaks on that).
- `scripts/dev/seed-clickhouse-adoption.mjs` — expands
  `adoption-router.ts`'s existing `FIXTURE_POPULATION` (a per-user *summary*:
  which step they reached, how it ended) into real per-step
  `activation_event` rows, so ClickHouse real mode and fixture mode tell the
  identical story for a given tenant — proven bit-for-bit: funnel counts,
  `weeklyActive`, `activatedSeats`, and `eligibleSeats` all match exactly
  between the two modes when seeded for the same tenant.
- Two real bugs found and fixed by actually running this against a live
  ClickHouse instance (neither had ever been exercised before today):
  1. `queryClickHouseJSON`'s `fetch(url, ...)` threw synchronously on any
     `CLICKHOUSE_URL` with embedded userinfo (`http://user:pass@host`) —
     Node's fetch (undici) rejects URLs with credentials outright, and
     `user:pass@host` is the standard way to express this connection
     string. Fixed via `clickHouseRequestTarget()`: strip credentials from
     the URL, carry them as a `Basic` auth header instead.
  2. `coverage` and `activeUsers` had real-mode gaps: `coverage.activatedSeats`
     was hardcoded to `0` regardless of what ClickHouse held
     (`isFixtureMode() ? activatedSeats : 0`), and `activeUsers.eligibleSeats`/
     `.trend` were hardcoded `0`/`[]`. Added `buildCoverageSQL` (grouped by
     `job_function_key`), `buildActivatedSeatsSQL`, and
     `buildWeeklyActiveTrendSQL`; `eligibleSeats` now sums real org headcount
     (`jobFunctionsInScope`) regardless of mode, since that's org structure,
     not activation-event data.
  3. (Smaller) `stalls`' real-mode rows used the raw `error_code` as their own
     `label` instead of the human-readable string fixture mode already had —
     added `STALL_LABEL_BY_ERROR_CODE`, a lookup shared by both modes.
- `packages/trpc/test/adoption-router.test.ts`: pure unit tests for every SQL
  builder (string-shape assertions, no live DB needed — these always run),
  plus `describe.skipIf(!process.env.CLICKHOUSE_URL)` integration tests that
  exercise the real procedures against a live instance when one is available.
  102/102 pass with `CLICKHOUSE_URL` set; the 3 live tests skip cleanly
  without it (99/102, 3 skipped) — CI and most dev machines will see the
  latter.
- `README.md` — a new "Local Dev Database" section with the full setup
  sequence; verified end-to-end in a browser (`/adoption` rendering real
  ClickHouse data — funnel, stalls with resolved labels, time-to-value
  histogram, coverage table — all matching the fixture-mode numbers exactly
  for the same seeded tenant).

## What did NOT ship (deliberately out of scope here)

- The other six-plus router files still on fixture-only stores
  (`catalog-router.ts`, `library-router.ts`, `onboarding-router.ts`,
  `index.ts`'s org-tree/spend/access routers). Postgres migrations are
  applied and verified working (`drizzle-kit push --force` against a clean
  DB produces all 39 tables cleanly), but no router queries Postgres yet —
  `adoption-router.ts`'s org/job-function data is local-fixture in both
  modes today (that data doesn't live in ClickHouse either way).
- Wave 4 ("reach": external discovery sources, review pipeline, Desktop GUI +
  MDM, cost-panel rework) — untouched, per the plan's own sequencing.

## Next slice, if continuing Wave 3

Same pattern, next router: pick one of `catalog-router.ts` (work packages +
assignments, the `/library` Packages tab's real data source) or
`library-router.ts` (component registry — `packages/artifactory` already has
real publish/resolve logic, just needs a Postgres-backed `ComponentRepoPort`
implementation instead of the in-memory one). Both would need actual
Postgres query wiring (this slice only needed ClickHouse), which is
unexercised territory — expect to find bugs there too.
