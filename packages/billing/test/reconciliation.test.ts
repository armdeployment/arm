import { describe, it, expect } from "vitest";
import { reconcile, type ProviderUsageResult } from "../src/index.js";

describe("reconcile", () => {
  const providerResult: ProviderUsageResult = {
    provider: "anthropic",
    days: [
      { date: "2026-07-01", model: "claude", inputTokens: 1000000, outputTokens: 50000, costUsd: 15, requests: 200 },
    ],
    totalCostUsd: 15,
    totalInputTokens: 1000000,
    totalOutputTokens: 50000,
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
  };

  it("reports ok when drift is within 5%", () => {
    const r = reconcile(providerResult, 14.50, { claude: 14.50 });
    expect(r.status).toBe("ok");
    expect(r.driftPct).toBeLessThan(5);
  });

  it("reports drift_warning when drift > 5%", () => {
    const r = reconcile(providerResult, 14.00, { claude: 14.00 });
    expect(r.status).toBe("drift_warning");
  });

  it("reports drift_critical when drift > 10%", () => {
    const r = reconcile(providerResult, 10, { claude: 10 });
    expect(r.status).toBe("drift_critical");
  });

  it("reports missing_data when both totals are zero", () => {
    const zero: ProviderUsageResult = { ...providerResult, totalCostUsd: 0, days: [] };
    const r = reconcile(zero, 0, {});
    expect(r.status).toBe("missing_data");
  });
});
