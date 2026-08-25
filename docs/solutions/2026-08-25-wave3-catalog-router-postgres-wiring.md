---
title: "Wave 3 DB wiring — catalog-router.ts on real Postgres"
date: 2026-08-25
status: shipped
supersedes: none
---

# Wave 3 DB Wiring: `catalog-router.ts` → Real Postgres

Continuation of `docs/solutions/2026-08-24-wave3-adoption-router-db-wiring.md`
(ClickHouse for `adoption-router.ts`). This slice does the same for
`catalog-router.ts` — work packages, versions, and package assignments — the
second, and first Postgres-backed, router in Wave 3's DB-wiring pass.

## What shipped

- `packages/db/src/client.ts` — the first real Postgres client in the repo
  (`getDb()`/`closeDb()`, a lazy `drizzle-orm/postgres-js` singleton).
  Foundational for every router after this one; moved `postgres` from
  `@arm/db`'s devDependencies to dependencies since it's now a real runtime
  need.
- `catalog-router.ts`: `isFixtureMode()` (same `ARM_FIXTURE_MODE` pattern as
  `adoption-router.ts`) gates all six procedures. Real mode reads/writes
  `work_package` / `work_package_version` / `package_assignment` via
  Drizzle; `pgPackageToWire`/`pgVersionToWire`/`pgAssignmentToView` map the
  camelCase Drizzle rows to the snake_case wire shapes
  `verifyManifestIntegrity` (server-side manifest hash re-check) already
  expected.
- `scripts/dev/seed-postgres-catalog.mjs` — seeds `tenant` + the same 6
  work-package / 4-assignment fixture data `catalog-router.ts`'s fixture
  mode uses, with the 6 real (library-migrated) component-bearing versions
  from `@arm/catalog`'s `packageVersionFixtures`.
- Tests: `packages/trpc/test/catalog-router.test.ts` gained a
  `describe.skipIf(!process.env.DATABASE_URL)` block — `listPackages`/
  `getPackage` read real rows, and a full `requestAssignment` →
  `approveAssignment` (×2) → `revokeAssignment` round trip proves state
  actually persists (a second, independent `listAssignments` call sees the
  terminal status). 106/106 with both `DATABASE_URL` and `CLICKHOUSE_URL`
  set; 99/106 (7 skipped) without either.

## A real bug found by seeding real data (not by writing more tests)

`apps/control-plane/web/src/app/api/trpc/[trpc]/route.ts`'s dev-mode tenant
context injected `tenant_id: "tn_demo"` — a human-readable placeholder, not a
UUID. `activation_event.tenant_id` (ClickHouse) is a plain `String`, so this
happened to work there, but `work_package.tenant_id` / `package_assignment.
tenant_id` (Postgres) are `uuid`-typed columns with FK constraints —
`"tn_demo"` could never match a real row, and would have failed loudly the
moment anyone loaded `/library` or `/governance` in real mode.
`apps/onboarding`'s own dev route already used a real UUID
(`d9d9d9d9-0000-4000-8000-000000000001`, `DEV_TENANT_ID`) for exactly this
reason — this just aligns `apps/control-plane/web` to the same value, so
both apps' real-mode data agree. (Only one file in
`apps/control-plane/web/src` referenced `"tn_demo"` — the route itself — so
this was a safely-scoped fix, not a wider rename.)

## Verified live in a browser, not just via tests

- `/library` Packages tab: all 6 real packages, correct component counts
  (10/9/8/6/8/8, matching library's real per-package component data) and
  budget caps ($950/$700/$420/$300/$400/$600 mo).
- Clicked "Request" on Quality Engineer — real `requestAssignment` mutation,
  confirmed the row landed in Postgres (`SELECT ... ORDER BY created_at DESC
  LIMIT 1` showed it immediately).
- `/governance` Approvals Inbox showed that exact request; clicked
  "Approve" — real `approveAssignment` mutation, confirmed `status =
  'approved'` and `approver_user_id` set in Postgres.

## Known limitation, not fixed here

`demo-mode.ts`'s ARM_DEMO guarantee (guide 04's "guaranteed read-only demo")
snapshots/restores in-memory registered stores only — it has no wire to
Postgres. `ARM_DEMO=1` combined with `ARM_FIXTURE_MODE=0` does **not**
currently guarantee a real-mode mutation reverts. Flagged in a code comment
in `catalog-router.ts`; a real fix would wrap real-mode mutations in a
transaction that rolls back under `ARM_DEMO`. Out of scope for this slice —
ARM_DEMO was designed against fixture mode, the only mode that existed when
it shipped.

## Next slice

`library-router.ts` (component registry) or `onboarding-router.ts`
(questionnaire responses, setup tokens) are the natural next targets — both
already have real Postgres tables from the same migration set applied here.
`index.ts`'s org-tree/spend/access/roles routers are a larger, more
speculative lift (that data doesn't map as cleanly onto D10's Postgres
schema yet) and are better scoped as their own slice.
