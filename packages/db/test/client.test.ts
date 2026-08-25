/**
 * Real Postgres client tests (Wave 3 DB wiring). `@arm/config` parses
 * `process.env` once at module load, so which of these two blocks is
 * meaningful depends on whether DATABASE_URL was set for the whole test
 * process — same split as packages/trpc/test/adoption-router.test.ts's
 * ClickHouse tests (CLICKHOUSE_URL).
 */

import { describe, it, expect, afterAll } from "vitest";

describe.skipIf(!!process.env.DATABASE_URL)("getDb — throws loud without DATABASE_URL", () => {
  it("throws a clear error rather than constructing a client to nowhere", async () => {
    const { getDb } = await import("../src/client.js");
    expect(() => getDb()).toThrow(/DATABASE_URL is not configured/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("getDb — live Postgres round-trip", () => {
  afterAll(async () => {
    const { closeDb } = await import("../src/client.js");
    await closeDb();
  });

  it("connects and can query the schema it just migrated", async () => {
    const { getDb } = await import("../src/client.js");
    const { tenantTable } = await import("../src/schema/org-tree.js");
    const db = getDb();
    const rows = await db.select().from(tenantTable).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});
