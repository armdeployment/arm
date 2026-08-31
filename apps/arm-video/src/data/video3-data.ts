// ── VIDEO 3: Wave 3 — Real Database Wiring ──────────────────────────────
// Real Postgres + ClickHouse data (docker-compose.dev-db.yml), captured
// live from the actual dashboard running with ARM_FIXTURE_MODE=0. See
// docs/solutions/2026-08-24-wave3-adoption-router-db-wiring.md,
// 2026-08-25-wave3-catalog-router-postgres-wiring.md, and
// 2026-08-25-wave3-library-router-postgres-wiring.md for what shipped.

import { COLORS } from "../theme";

export const V3 = {
  routers: [
    {
      name: "adoption-router.ts",
      store: "ClickHouse",
      verb: "6 of 6 procedures",
      color: COLORS.cyan,
    },
    {
      name: "catalog-router.ts",
      store: "Postgres",
      verb: "6 of 6 procedures",
      color: COLORS.navy,
    },
    {
      name: "library-router.ts",
      store: "Postgres",
      verb: "9 of 12 procedures",
      color: COLORS.gold,
    },
  ],

  // Real numbers, read live off /adoption with ARM_FIXTURE_MODE=0
  // (ClickHouse activation_event rows, not a canned response).
  adoption: {
    weeklyActive: 103,
    activatedSeats: 132,
    eligibleSeats: 383,
    invited: 340,
    topStall: { cause: "MDM push failed on corporate device", count: 35 },
  },

  // Real numbers, read live off /library with ARM_FIXTURE_MODE=0
  // (Postgres component + component_version rows).
  library: {
    totalComponents: 79,
    kinds: [
      { label: "Cli", value: 21 },
      { label: "Skill", value: 20 },
      { label: "Template", value: 13 },
      { label: "Http_api", value: 15 },
      { label: "Subagent", value: 5 },
      { label: "Mcp", value: 2 },
      { label: "Connector", value: 2 },
      { label: "Prompt_pack", value: 1 },
    ],
    firstParty: 78,
    tenantAuthored: 1,
  },

  // Real numbers, read live off /assignments with ARM_FIXTURE_MODE=0
  // (Postgres package_assignment rows, D9 request/approve/revoke state machine).
  assignments: {
    total: 8,
    states: [
      { label: "Requested", value: 1, color: COLORS.amber },
      { label: "Approved", value: 2, color: COLORS.navy },
      { label: "Active", value: 1, color: COLORS.green },
      { label: "Revoked", value: 4, color: COLORS.red },
    ],
  },

  // Real bugs, found by clicking buttons in a live browser, not by
  // writing more unit tests.
  bugsFound: [
    {
      title: `"tn_demo" is not a UUID`,
      detail:
        "Postgres tenant_id/owner_user_id columns are uuid-typed with FK constraints — the dev route's human-readable placeholders always failed against real mode, silently passed in fixture mode.",
    },
    {
      title: "eligibleSeats & trend hardcoded to 0 / []",
      detail:
        "adoption-router.ts's real-mode branch never queried ClickHouse for two of activeUsers's four fields — only caught by reading the live number, not by a passing test.",
    },
    {
      title: "Node fetch() rejects credentialed URLs",
      detail: `CLICKHOUSE_URL="http://user:pass@host" is the standard way to express it — crashed until credentials were split into a Basic auth header.`,
    },
  ],

  testSummary: {
    files: 6,
    tests: 111,
    withLiveDb: "DATABASE_URL + CLICKHOUSE_URL set",
  },
};
