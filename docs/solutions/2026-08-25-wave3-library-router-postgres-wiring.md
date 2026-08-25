---
title: "Wave 3 DB wiring — library-router.ts on real Postgres"
date: 2026-08-25
status: shipped
supersedes: none
---

# Wave 3 DB Wiring: `library-router.ts` → Real Postgres

Third router, continuing `docs/solutions/2026-08-24-wave3-adoption-router-db-wiring.md`
(ClickHouse, `adoption-router.ts`) and `docs/solutions/2026-08-25-wave3-catalog-router-postgres-wiring.md`
(Postgres, `catalog-router.ts`). This is the Component Registry + Discovery
router — the largest and most structurally interesting of the three: it's
the one `packages/artifactory`'s `ComponentRepoPort` injection design was
built for.

## What shipped

- `isFixtureMode()` gates all 9 data-bearing procedures (`search`, `facets`,
  `getComponent`, `listVersions`, `publishVersion`, `listSources`,
  `listCandidates`, `promoteCandidate`, `rejectCandidate`). `listJobFunctions`/
  `recommendForJobFunction`/`gaps` stay on `@arm/profiles`' preset data in
  both modes — that's D6's "profile sets defaults" design, not a fixture
  gap.
- `postgresComponentRepo: ComponentRepoPort` — the real implementation of
  the port `packages/artifactory/src/publish.ts` was already written
  against. `realStorageBackends` uses `FsStorageBackend` (real files on
  disk, `ARM_ARTIFACT_STORAGE_DIR`) instead of the in-memory stand-in.
  `publishVersion` picks repo/backends by `isFixtureMode()` — same
  `publishComponentVersion` call either way.
- Row mappers (`pgComponentToWire`, `pgVersionToComponentVersion`,
  `pgSourceToWire`, `pgCandidateToWire`) — camelCase Drizzle rows to the
  snake_case `@arm/proto` wire shapes, same pattern as the other two
  routers.
- Real-mode derived signals (`derivedJobFunctionsForComponentPg`,
  `installCountForComponentPg`) query Postgres `work_package_version` rows
  instead of `@arm/catalog`'s static fixtures — correct because
  `catalog-router.ts`'s real-mode mutations (from the previous slice) can
  now actually change that data.
- `scripts/dev/seed-postgres-library.mjs` — seeds `component` /
  `component_version` / `component_blob` (79/80/2 rows, from
  `@arm/artifactory`'s real fixtures) + `discovery_source` /
  `discovery_candidate` (copied from library-router.ts's local fixtures,
  not exported from any package).
- Tests: 5 new `describe.skipIf(!process.env.DATABASE_URL)` cases —
  `search`, `getComponent`, `listSources`/`listCandidates`, a full
  `promoteCandidate` round trip (persisted, verified via an independent
  `listCandidates` call), and `publishVersion` (writes a real
  `component_version` row, verified via `listVersions`). 111/111 with both
  `DATABASE_URL`/`CLICKHOUSE_URL` set; 99/111 (12 skipped) without.

## Two real bugs found by clicking buttons in a browser, not by writing tests

1. **Test claims needed a real UUID.** `owner_user_id`/`published_by`/
   `reviewed_by` are `uuid`-typed Postgres columns; the existing test
   file's `fixtureTenantClaims.sub` is `"user_01"` (fine for fixture mode,
   which never re-parses through `componentSchema`'s `.uuid()` constraint —
   Postgres correctly rejects it). Added `realUserClaims` with a real UUID
   `sub` for the mutation tests specifically.
2. **The same bug, for real, in `apps/control-plane/web`'s dev route.**
   `DEV_TENANT_ID` got fixed to a real UUID in the previous slice, but
   `sub: "dev-user"` was never touched — and library-router.ts's
   `publishVersion`/`promoteCandidate` are the first real-mode procedures
   that write `claims.sub` straight into a `uuid` column
   (`catalog-router.ts` never did; it hardcodes `FIXTURE_APPROVER_ID`
   instead). Clicking "Promote" in a real browser hit exactly this —
   confirmed via `console` (a stray 500) and Postgres inspection (the
   candidate was stuck in a half-transitioned state from an earlier
   automated-test run, not the browser click, which took two attempts to
   disambiguate). Added `DEV_USER_ID` alongside `DEV_TENANT_ID`, matching
   the `OWNER_ID`/`FIXTURE_OWNER_ID` convention `@arm/artifactory`'s
   fixtures and `catalog-router.ts` already use.

## Verified live in a browser

- `/library` Components tab, searching "jira": real facet counts across
  all 79 seeded components (Mcp:2, Connector:2, Cli:21, Http_api:15,
  Skill:20, Subagent:5, Template:13, Prompt_pack:1 — sums to 79; Source
  First_party:78/Tenant_authored:1) — computed live by `computeFacets`
  over real Postgres rows, not a canned response.
- `/library` Discovery tab: the real seeded candidate ("Example External
  Connector"). Clicked "Promote" — confirmed via direct Postgres query
  that `discovery_candidate.status` moved to `'promoted'` and a new
  `component` row landed with `review_status='draft'`,
  `source_kind='imported'` (exactly `promoteCandidate`'s documented
  contract). Reset both rows afterward so the seed stays reusable.

## Known limitations, not fixed here

- Same `ARM_DEMO` + real-mode caveat as the catalog-router slice
  (`demo-mode.ts` has no wire to Postgres).
- The UI doesn't refetch `listCandidates` after a successful
  `promoteCandidate`/`rejectCandidate` in real mode (fixture mode's
  in-memory store update happens to look live because the query re-runs
  against the same mutated array; real mode needs an explicit
  `utils.library.listCandidates.invalidate()`, same pattern
  `library/page.tsx` already uses elsewhere). Cosmetic, not a data bug —
  confirmed the underlying mutation is correct via direct DB inspection.
  Worth a follow-up but out of scope for this DB-wiring pass.

## Next slice

Three of the highest-visibility routers (adoption, catalog, library) are
now real. `onboarding-router.ts` (questionnaire responses, setup tokens —
security-sensitive: single-use tokens, rate limiting) and `index.ts`'s
org-tree/spend/access/roles/agents routers remain fixture-only.
