/**
 * ARM ClickHouse event-ledger schema module.
 *
 * Ships the raw SQL from spec §4.2 verbatim (it IS the contract) and exports the
 * table names + statements programmatically for the apply script and tests.
 *
 * Invariant 6 (spec §11.6): partitioned by (tenant_id, toYYYYMM(ts)) from day 1.
 * Invariant 1 (spec §11.1): METADATA + AUDIT ONLY — no prompt bodies, no content.
 *   A content field appearing in either schema is a guardrail failure
 *   (scripts/guardrails/no-content-egress).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const CLICKHOUSE_TABLES = ["token_usage_event", "access_audit_event"] as const;
export type ClickHouseTable = (typeof CLICKHOUSE_TABLES)[number];

/** D10 adoption event tables (guide 00 §6) — shipped in a separate migration
 *  (0003_adoption.sql) from the day-1 tables above. Kept as a distinct
 *  constant/SQL export rather than merged into CLICKHOUSE_TABLES/INIT_SQL so
 *  every existing consumer of those two (e.g. guardrails/no-content-egress,
 *  which scans INIT_SQL specifically) is unaffected by this addition. */
export const ADOPTION_TABLES = ["activation_event", "component_pull_event"] as const;
export type AdoptionTable = (typeof ADOPTION_TABLES)[number];

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The day-1 init migration SQL (spec §4.2). Exported for the apply script + tests. */
export const INIT_SQL: string = readFileSync(
  resolve(__dirname, "../migrations/0001_init.sql"),
  "utf8",
);

/** The D10 adoption migration SQL (guide 00 §6). Exported for the apply script + tests. */
export const ADOPTION_SQL: string = readFileSync(
  resolve(__dirname, "../migrations/0003_adoption.sql"),
  "utf8",
);

/** Asserts the partition scheme is present in the shipped SQL — fail-loud guard
 *  for Invariant 6. Call from tests and the apply path; never let a regression
 *  to a non-tenant-partitioned layout ship silently. */
export function assertTenantMonthPartitioning(sql: string = INIT_SQL): void {
  const both = sql.includes("PARTITION BY (tenant_id, toYYYYMM(ts))");
  if (!both) {
    throw new Error(
      "Invariant 6 violated: ClickHouse event tables must PARTITION BY (tenant_id, toYYYYMM(ts)).",
    );
  }
  const tableCount = (sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length;
  if (tableCount !== CLICKHOUSE_TABLES.length) {
    throw new Error(
      `Expected ${CLICKHOUSE_TABLES.length} event tables, found ${tableCount}. ` +
        "Did a table get dropped from 0001_init.sql?",
    );
  }
}

/** Same assertion as `assertTenantMonthPartitioning`, scoped to the D10
 *  adoption migration (guide 00 §6: "Both partitioned (tenant_id,
 *  toYYYYMM(ts)) — Invariant 6, asserted at runtime the same way
 *  0001_init.sql is."). Kept as a separate function (not a parameter default
 *  on the existing one) so a regression in either migration fails with an
 *  unambiguous message naming the right file. */
export function assertAdoptionPartitioning(sql: string = ADOPTION_SQL): void {
  const both = sql.includes("PARTITION BY (tenant_id, toYYYYMM(ts))");
  if (!both) {
    throw new Error(
      "Invariant 6 violated: ClickHouse adoption event tables must PARTITION BY (tenant_id, toYYYYMM(ts)).",
    );
  }
  const tableCount = (sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length;
  if (tableCount !== ADOPTION_TABLES.length) {
    throw new Error(
      `Expected ${ADOPTION_TABLES.length} adoption event tables, found ${tableCount}. ` +
        "Did a table get dropped from 0003_adoption.sql?",
    );
  }
}

assertTenantMonthPartitioning();
assertAdoptionPartitioning();
