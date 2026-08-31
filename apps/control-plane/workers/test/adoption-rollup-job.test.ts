/**
 * adoptionRollupJob tests (docs/guides/02-server-panels.md §5.1/§8:
 * "adoptionRollupJob implemented and tested").
 */

import { describe, it, expect } from "vitest";
import { computeAdoptionRollup, runAdoptionRollupJob } from "../src/adoption-rollup-job.js";
import { ACTIVATION_STEPS, FIXTURE_POPULATION } from "@arm/trpc/adoption-router";

describe("computeAdoptionRollup — real aggregation over the activation population", () => {
  it("produces rows only for steps a user actually reached (cumulative funnel semantics)", () => {
    const rows = computeAdoptionRollup("tn_demo");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(ACTIVATION_STEPS).toContain(r.step);
      expect(r.count).toBeGreaterThan(0);
      expect(r.tenantId).toBe("tn_demo");
    }
  });

  it("the 'invited' step count matches the number of non-gap users with reachedStepIndex >= 0", () => {
    const rows = computeAdoptionRollup("tn_demo");
    const invitedTotal = rows.filter((r) => r.step === "invited").reduce((n, r) => n + r.count, 0);
    const expected = FIXTURE_POPULATION.filter((u) => u.reachedStepIndex >= 0).length;
    expect(invitedTotal).toBe(expected);
  });

  it("counts are monotonically non-increasing across the step order, per (org_node, job_function)", () => {
    const rows = computeAdoptionRollup("tn_demo");
    const byGroup = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.day}:${r.orgNodeId}:${r.jobFunctionKey}`;
      byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
    }
    for (const group of byGroup.values()) {
      const sorted = [...group].sort(
        (a, b) => ACTIVATION_STEPS.indexOf(a.step) - ACTIVATION_STEPS.indexOf(b.step),
      );
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.count).toBeLessThanOrEqual(sorted[i - 1]!.count);
      }
    }
  });

  it("is deterministic (same seeded fixture population every call)", () => {
    const a = computeAdoptionRollup("tn_demo");
    const b = computeAdoptionRollup("tn_demo");
    expect(a).toEqual(b);
  });

  it("rows are sorted by day, org node, job function, step order", () => {
    const rows = computeAdoptionRollup("tn_demo");
    const tuple = (r: (typeof rows)[number]) =>
      [r.day, r.orgNodeId, r.jobFunctionKey, ACTIVATION_STEPS.indexOf(r.step)] as const;
    for (let i = 1; i < rows.length; i++) {
      const a = tuple(rows[i - 1]!);
      const b = tuple(rows[i]!);
      // Lexicographic tuple comparison, numeric on the last field.
      const cmp =
        a[0].localeCompare(b[0]) ||
        a[1].localeCompare(b[1]) ||
        a[2].localeCompare(b[2]) ||
        a[3] - b[3];
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });
});

describe("runAdoptionRollupJob", () => {
  it("fixture mode: returns ok with real computed rows", async () => {
    const result = await runAdoptionRollupJob("tn_demo");
    expect(result.status).toBe("ok");
    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.rows.length).toBe(result.rowCount);
  });
});
