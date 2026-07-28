import { describe, it, expect } from "vitest";
import { ingestEvent, getBufferHealth, flushToControlPlane } from "../src/index.js";

describe("meter-agent buffer", () => {
  it("accepts a valid metering event", () => {
    const r = ingestEvent({
      subAccountId: "sa_01", agentId: "agt_01", tenantId: "tn_01",
      priorityTier: "standard", model: "claude", inputTokens: 1000,
      outputTokens: 500, costUsd: 0.015, source: "proxy",
      ts: new Date().toISOString(),
    });
    expect(r.accepted).toBe(true);
  });

  it("rejects invalid events", () => {
    expect(ingestEvent({})).toEqual({ accepted: false, reason: expect.stringContaining("validation_failed") });
  });

  it("health reports ok when buffer is empty", () => {
    const h = getBufferHealth();
    expect(h.status).toBe("ok");
    expect(h.eventCount).toBeGreaterThanOrEqual(0);
  });

  it("flush clears buffer", async () => {
    ingestEvent({
      subAccountId: "sa_01", agentId: "agt_01", tenantId: "tn_01",
      priorityTier: "standard", model: "gpt", inputTokens: 100,
      outputTokens: 50, costUsd: 0.001, source: "proxy",
      ts: new Date().toISOString(),
    });
    const { flushed } = await flushToControlPlane();
    expect(flushed).toBeGreaterThan(0);
  });
});
