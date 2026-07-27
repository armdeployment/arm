/**
 * Unit tests for mock data + utility logic.
 *
 * Component-level tests (rendering charts/tables) require jsdom + a React
 * testing setup — deferred until the design system stabilizes. These tests
 * verify the data layer that feeds every dashboard surface, which is the
 * contract that matters before wiring live tRPC data.
 */

import { describe, it, expect } from "vitest";
import { agents, modelSpend, summary, spendTrend, tierBreakdown } from "../src/lib/mock-data";

describe("mock data — summary metrics", () => {
  it("totalMonthlySpend is a positive number", () => {
    expect(summary.totalMonthlySpend).toBeGreaterThan(0);
  });

  it("proxiedTrafficPct meets the ≥80% adoption target (spec §9)", () => {
    expect(summary.proxiedTrafficPct).toBeGreaterThanOrEqual(80);
  });

  it("tier counts sum to agentCount", () => {
    const sum = tierBreakdown.reduce((n, t) => n + t.count, 0);
    expect(sum).toBe(summary.agentCount);
  });

  it("criticalReservePct + backgroundFloorPct leave room for standard", () => {
    expect(summary.criticalReservePct + summary.backgroundFloorPct).toBeLessThan(100);
  });
});

describe("mock data — agents", () => {
  it("every agent has a non-empty stakeholder (Invariant §11.7)", () => {
    for (const a of agents) {
      expect(a.stakeholder).toBeTruthy();
    }
  });

  it("every agent has a valid priority tier (Invariant §11.8)", () => {
    const valid = new Set(["critical", "standard", "background"]);
    for (const a of agents) {
      expect(valid.has(a.tier)).toBe(true);
    }
  });

  it("agents are sorted by monthlySpend descending", () => {
    for (let i = 1; i < agents.length; i++) {
      expect(agents[i]!.monthlySpend).toBeLessThanOrEqual(agents[i - 1]!.monthlySpend);
    }
  });
});

describe("mock data — model spend", () => {
  it("has both closed and self_hosted models (DLP gate relevance, §6.5)", () => {
    const kinds = new Set(modelSpend.map((m) => m.kind));
    expect(kinds.has("closed")).toBe(true);
    expect(kinds.has("self_hosted")).toBe(true);
  });

  it("model spend sums to approximately totalMonthlySpend", () => {
    const sum = modelSpend.reduce((n, m) => n + m.spend, 0);
    // Allow tolerance — mock data is approximate.
    expect(Math.abs(sum - summary.totalMonthlySpend)).toBeLessThan(500);
  });
});

describe("mock data — spend trend", () => {
  it("has multiple data points for a meaningful chart", () => {
    expect(spendTrend.length).toBeGreaterThanOrEqual(4);
  });

  it("glm spend trends upward (cost-steering story, §8.3)", () => {
    const first = spendTrend[0]!.glm;
    const last = spendTrend[spendTrend.length - 1]!.glm;
    expect(last).toBeGreaterThan(first);
  });
});
