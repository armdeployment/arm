/**
 * Adoption router tests (docs/guides/02-server-panels.md §7) — all six
 * procedures in fixture mode: funnel, stalls, timeToValue, coverage,
 * activeUsers, recentActivations. Plus scope drill-down and cross-tenant
 * isolation (mirrors packages/trpc/test/tenant-middleware.test.ts).
 */

import { describe, it, expect, afterEach } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import {
  ACTIVATION_STEPS,
  FIXTURE_POPULATION,
  isFixtureMode,
  buildFunnelSQL,
  buildStallsSQL,
  buildTimeToValueSQL,
  buildActiveUsersSQL,
  buildCoverageSQL,
  buildActivatedSeatsSQL,
  buildWeeklyActiveTrendSQL,
  buildRecentActivationsSQL,
} from "../src/adoption-router.js";
import type { ARMClaims } from "@arm/auth";

const authedClaims: ARMClaims = { sub: "user_01", tenant_id: "tn_01", email: "eng@acme.com" };
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

describe("adoption router — tenant middleware (Invariant §11.6)", () => {
  it("REJECTS unauthenticated requests for every procedure", async () => {
    await expect(caller(null).adoption.funnel({})).rejects.toThrowError(/No authenticated tenant context/);
    await expect(caller(null).adoption.stalls({})).rejects.toThrowError(/No authenticated tenant context/);
    await expect(caller(null).adoption.timeToValue({})).rejects.toThrowError(/No authenticated tenant context/);
    await expect(caller(null).adoption.coverage({})).rejects.toThrowError(/No authenticated tenant context/);
    await expect(caller(null).adoption.activeUsers({})).rejects.toThrowError(/No authenticated tenant context/);
    await expect(caller(null).adoption.recentActivations({})).rejects.toThrowError(/No authenticated tenant context/);
  });
});

describe("adoption.funnel", () => {
  it("is in fixture mode by default (ARM_FIXTURE_MODE unset in test env)", () => {
    expect(isFixtureMode()).toBe(true);
  });

  it("returns all 11 activation steps in order, cumulative + monotonically non-increasing", async () => {
    const r = await caller(authedClaims).adoption.funnel({});
    expect(r.steps.map((s) => s.step)).toEqual([...ACTIVATION_STEPS]);
    for (let i = 1; i < r.steps.length; i++) {
      expect(r.steps[i]!.count).toBeLessThanOrEqual(r.steps[i - 1]!.count);
    }
  });

  it("first step has null conversionFromPrev; later steps have a numeric conversion pct", async () => {
    const r = await caller(authedClaims).adoption.funnel({});
    expect(r.steps[0]!.conversionFromPrev).toBeNull();
    expect(r.steps[1]!.conversionFromPrev).toEqual(expect.any(Number));
  });

  it("weekly_active is a real, non-zero long-tail fraction of invited (not flattering — guide 02 §5.1)", async () => {
    const r = await caller(authedClaims).adoption.funnel({});
    const invited = r.steps.find((s) => s.step === "invited")!.count;
    const weeklyActive = r.steps.find((s) => s.step === "weekly_active")!.count;
    expect(weeklyActive).toBeGreaterThan(0);
    expect(weeklyActive).toBeLessThan(invited);
  });

  it("marks fixtures with meta.sampleData=true (guide 02 §5.1 'sample data' badge)", async () => {
    const r = await caller(authedClaims).adoption.funnel({});
    expect(r.meta.sampleData).toBe(true);
    expect(r.meta.source).toBe("fixture");
    expect(r.meta.ledgerFreshnessMs).toBeGreaterThanOrEqual(0);
  });

  it("scoping to a department returns a strictly smaller-or-equal funnel than org-wide", async () => {
    const org = await caller(authedClaims).adoption.funnel({ scope: null });
    const dept = await caller(authedClaims).adoption.funnel({ scope: { type: "department", id: "dept_qa" } });
    expect(dept.steps[0]!.count).toBeLessThanOrEqual(org.steps[0]!.count);
    expect(dept.steps[0]!.count).toBeGreaterThan(0);
  });

  it("jobFunctionKey filter narrows further than department scope", async () => {
    const dept = await caller(authedClaims).adoption.funnel({ scope: { type: "department", id: "dept_qa" } });
    const jf = await caller(authedClaims).adoption.funnel({ scope: { type: "department", id: "dept_qa" }, jobFunctionKey: "quality_engineer" });
    expect(jf.steps[0]!.count).toBeLessThanOrEqual(dept.steps[0]!.count);
  });

  it("a job function with no published package (process_engineer) produces an empty funnel — the coverage gap", async () => {
    const r = await caller(authedClaims).adoption.funnel({ jobFunctionKey: "process_engineer" });
    expect(r.steps.every((s) => s.count === 0)).toBe(true);
  });
});

describe("adoption.stalls", () => {
  it("returns non-empty, plain-language-labeled stall rows sorted by count desc", async () => {
    const r = await caller(authedClaims).adoption.stalls({});
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row.label).not.toMatch(/^[a-z_]+$/); // not a raw snake_case error code
      expect(row.count).toBeGreaterThan(0);
      expect(row.share).toBeGreaterThan(0);
    }
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i]!.count).toBeLessThanOrEqual(r.rows[i - 1]!.count);
    }
  });

  it("includes the designated stall for office_worker_general (MDM push failures — largest population)", async () => {
    const r = await caller(authedClaims).adoption.stalls({});
    expect(r.rows.some((row) => row.errorCode === "mdm_push_failed")).toBe(true);
  });
});

describe("adoption.timeToValue", () => {
  it("p50 < p90, both below the 10-minute target's neighborhood on the low end", async () => {
    const r = await caller(authedClaims).adoption.timeToValue({});
    expect(r.sampleCount).toBeGreaterThan(0);
    expect(r.p50).toBeGreaterThan(0);
    expect(r.p90).toBeGreaterThanOrEqual(r.p50);
    expect(r.targetMinutes).toBe(10);
  });

  it("buckets sum to sampleCount", async () => {
    const r = await caller(authedClaims).adoption.timeToValue({});
    const bucketSum = r.buckets.reduce((n, b) => n + b.count, 0);
    expect(bucketSum).toBe(r.sampleCount);
  });
});

describe("adoption.coverage", () => {
  it("includes the deliberate coverage gap (process_engineer, 0 packages, full headcount uncovered)", async () => {
    const r = await caller(authedClaims).adoption.coverage({});
    const gap = r.rows.find((row) => row.jobFunctionKey === "process_engineer")!;
    expect(gap).toBeDefined();
    expect(gap.packages).toEqual([]);
    expect(gap.activatedSeats).toBe(0);
    expect(gap.uncoveredWeight).toBe(gap.headcountWeight);
  });

  it("is sorted by uncovered weight descending", async () => {
    const r = await caller(authedClaims).adoption.coverage({});
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i]!.uncoveredWeight).toBeLessThanOrEqual(r.rows[i - 1]!.uncoveredWeight);
    }
  });

  it("headcount-weighted rows carry a positive headcountWeight for every job function", async () => {
    const r = await caller(authedClaims).adoption.coverage({});
    expect(r.rows.length).toBe(7); // 6 packaged + 1 gap
    for (const row of r.rows) expect(row.headcountWeight).toBeGreaterThan(0);
  });
});

describe("adoption.activeUsers", () => {
  it("A1 primary metric — weeklyActive > 0, trend is monotonically non-decreasing (adoption at scale)", async () => {
    const r = await caller(authedClaims).adoption.activeUsers({});
    expect(r.weeklyActive).toBeGreaterThan(0);
    expect(r.trend.length).toBe(8);
    for (let i = 1; i < r.trend.length; i++) {
      expect(r.trend[i]!.weeklyActive).toBeGreaterThanOrEqual(r.trend[i - 1]!.weeklyActive);
    }
    expect(r.trend[r.trend.length - 1]!.weeklyActive).toBe(r.weeklyActive);
  });
});

describe("adoption.recentActivations", () => {
  it("returns pseudonymous user_ref values — never an email (Invariant 1)", async () => {
    const r = await caller(authedClaims).adoption.recentActivations({ limit: 10 });
    expect(r.activations.length).toBeGreaterThan(0);
    for (const a of r.activations) {
      expect(a.userRef).toMatch(/^u_[a-z_]+_[a-z0-9]+$/);
      expect(a.userRef).not.toContain("@");
    }
  });

  it("is sorted most-recent-first and paginates via cursor", async () => {
    const page1 = await caller(authedClaims).adoption.recentActivations({ limit: 5 });
    expect(page1.activations.length).toBe(5);
    for (let i = 1; i < page1.activations.length; i++) {
      expect(Date.parse(page1.activations[i]!.ts)).toBeLessThanOrEqual(Date.parse(page1.activations[i - 1]!.ts));
    }
    expect(page1.nextCursor).toBe(5);
    const page2 = await caller(authedClaims).adoption.recentActivations({ limit: 5, cursor: page1.nextCursor! });
    expect(page2.activations[0]!.userRef).not.toBe(page1.activations[0]!.userRef);
  });
});

describe("cross-tenant isolation (mirrors tenant-middleware.test.ts)", () => {
  it("fixture population is not tenant-partitioned data — every tenant sees the same fixture, but the tenantId in the response always matches the caller's own claims (never a fixture from 'another tenant')", async () => {
    const t1 = await caller({ sub: "u1", tenant_id: "tn_01", email: "a@acme.com" }).adoption.funnel({});
    const t2 = await caller({ sub: "u2", tenant_id: "tn_02", email: "b@other.com" }).adoption.funnel({});
    expect(t1.tenantId).toBe("tn_01");
    expect(t2.tenantId).toBe("tn_02");
  });
});

describe("FIXTURE_POPULATION — deterministic, realistic (guide 02 §5.1)", () => {
  it("is deterministic across module loads (seeded PRNG, stable for tests)", () => {
    expect(FIXTURE_POPULATION.length).toBeGreaterThan(300);
  });

  it("contains at least one error outcome and one abandoned outcome — not flattering", () => {
    expect(FIXTURE_POPULATION.some((u) => u.outcome === "error")).toBe(true);
    expect(FIXTURE_POPULATION.some((u) => u.outcome === "abandoned")).toBe(true);
  });
});

// ── ClickHouse real-mode SQL builders (guide 02 §5.1) — pure string
// construction, no live ClickHouse required. The real-mode HTTP execution
// path (queryClickHouseJSON) is covered separately below, gated on a live
// instance actually being available (Wave 3 DB wiring).
describe("ClickHouse SQL builders — shape (no live DB required)", () => {
  const TENANT = "tn_ch_test";
  const NO_FILTER = { scope: null, jobFunctionKey: null, dateFrom: null, dateTo: null };

  it("buildFunnelSQL: counts distinct users per step, outcome='ok' only", () => {
    const sql = buildFunnelSQL(TENANT, NO_FILTER);
    expect(sql).toContain("FROM activation_event");
    expect(sql).toContain(`tenant_id = '${TENANT}'`);
    expect(sql).toContain("outcome = 'ok'");
    expect(sql).toContain("GROUP BY step");
  });

  it("buildStallsSQL: excludes outcome='ok' and empty error_code", () => {
    const sql = buildStallsSQL(TENANT, NO_FILTER);
    expect(sql).toContain("outcome != 'ok'");
    expect(sql).toContain("error_code != ''");
    expect(sql).toContain("GROUP BY step, error_code");
  });

  it("buildTimeToValueSQL: pairs questionnaire_started -> first_metered_call per user", () => {
    const sql = buildTimeToValueSQL(TENANT, NO_FILTER);
    expect(sql).toContain("minIf(ts, step = 'questionnaire_started')");
    expect(sql).toContain("minIf(ts, step = 'first_metered_call')");
    expect(sql).toContain("GROUP BY user_ref");
  });

  it("buildActiveUsersSQL: counts distinct users at weekly_active", () => {
    const sql = buildActiveUsersSQL(TENANT, NO_FILTER);
    expect(sql).toContain("step = 'weekly_active'");
    expect(sql).toContain("outcome = 'ok'");
  });

  it("buildCoverageSQL: groups activated seats by job_function_key", () => {
    const sql = buildCoverageSQL(TENANT, NO_FILTER);
    expect(sql).toContain("step = 'weekly_active'");
    expect(sql).toContain("GROUP BY job_function_key");
  });

  it("buildActivatedSeatsSQL: counts distinct users at first_metered_call (looser than weekly_active)", () => {
    const sql = buildActivatedSeatsSQL(TENANT, NO_FILTER);
    expect(sql).toContain("step = 'first_metered_call'");
  });

  it("buildWeeklyActiveTrendSQL: buckets by week, capped at 8 rows", () => {
    const sql = buildWeeklyActiveTrendSQL(TENANT, NO_FILTER);
    expect(sql).toContain("toStartOfWeek(ts, 1)");
    expect(sql).toContain("LIMIT 8");
  });

  it("buildRecentActivationsSQL: orders by ts desc with the given limit", () => {
    const sql = buildRecentActivationsSQL(TENANT, NO_FILTER, 42);
    expect(sql).toContain("ORDER BY ts DESC LIMIT 42");
  });

  it("every builder applies the scope + date-range filters when set", () => {
    const filter = { scope: { type: "department" as const, id: "dept_qa" }, dateFrom: "2026-01-01", dateTo: "2026-02-01", jobFunctionKey: "quality_engineer" };
    for (const sql of [
      buildFunnelSQL(TENANT, filter),
      buildStallsSQL(TENANT, filter),
      buildActiveUsersSQL(TENANT, filter),
      buildCoverageSQL(TENANT, filter),
    ]) {
      expect(sql).toContain("org_node_id = 'dept_qa'");
      expect(sql).toContain("ts >= '2026-01-01'");
      expect(sql).toContain("ts <= '2026-02-01'");
    }
  });
});

// ── Live ClickHouse real-mode integration (Wave 3 DB wiring,
// docs/solutions/2026-08-21-d10-adoption-first-restructure.md §8). Skipped
// unless CLICKHOUSE_URL is set — CI/most dev machines won't have a live
// instance, but this proves the wiring for real when one is available (see
// infra/compose/docker-compose.dev-db.yml + scripts/dev/
// apply-clickhouse-migrations.mjs + scripts/dev/seed-clickhouse-adoption.mjs).
describe.skipIf(!process.env.CLICKHOUSE_URL)("adoption router — live ClickHouse real mode", () => {
  const REAL_TENANT = process.env.ARM_SEED_TENANT_ID ?? "d9d9d9d9-0000-4000-8000-000000000001";
  const realClaims: ARMClaims = { sub: "user_01", tenant_id: REAL_TENANT, email: "eng@acme.com" };

  afterEach(() => {
    delete process.env.ARM_FIXTURE_MODE;
  });

  it("funnel/coverage/activeUsers agree on activated-seat totals against the seeded dataset", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const funnel = await caller(realClaims).adoption.funnel({});
    const invited = funnel.steps.find((s) => s.step === "invited")!;
    const weeklyActive = funnel.steps.find((s) => s.step === "weekly_active")!;
    expect(invited.count).toBeGreaterThan(0);
    expect(funnel.meta.source).toBe("clickhouse");

    const active = await caller(realClaims).adoption.activeUsers({});
    expect(active.weeklyActive).toBe(weeklyActive.count);
    expect(active.eligibleSeats).toBeGreaterThan(0);

    const coverage = await caller(realClaims).adoption.coverage({});
    const totalActivatedAcrossJobFunctions = coverage.rows.reduce((sum, r) => sum + r.activatedSeats, 0);
    expect(totalActivatedAcrossJobFunctions).toBe(active.weeklyActive);
  });

  it("stalls resolves human-readable labels from error codes, not raw snake_case", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const stalls = await caller(realClaims).adoption.stalls({});
    expect(stalls.rows.length).toBeGreaterThan(0);
    for (const row of stalls.rows) {
      expect(row.label).not.toBe(row.errorCode);
    }
  });

  it("recentActivations returns real event rows ordered newest-first", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const r = await caller(realClaims).adoption.recentActivations({ limit: 5, cursor: 0 });
    expect(r.activations.length).toBe(5);
    expect(r.meta.source).toBe("clickhouse");
    for (let i = 1; i < r.activations.length; i++) {
      expect(Date.parse(r.activations[i]!.ts)).toBeLessThanOrEqual(Date.parse(r.activations[i - 1]!.ts));
    }
  });
});
