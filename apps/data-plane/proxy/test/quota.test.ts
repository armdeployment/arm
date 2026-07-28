import { describe, it, expect } from "vitest";
import { checkQuota, checkModelAccess, type AgentContext } from "../src/index.js";

const baseAgent: AgentContext = {
  subAccountId: "sa_test", agentId: "agt_test", tenantId: "tn_test",
  priorityTier: "standard", classificationClearance: "internal",
  quota: { dailyCapUsd: 50, usedTodayUsd: 0 }, allowedModels: ["claude-sonnet-4-20250514", "gpt-4o", "glm-5.2"],
};

describe("checkQuota — priority-aware enforcement", () => {
  it("allows when under cap", () => {
    expect(checkQuota(baseAgent, 1).allowed).toBe(true);
  });

  it("allows critical tier even when quota exhausted", () => {
    const critical = { ...baseAgent, priorityTier: "critical" as const, quota: { dailyCapUsd: 50, usedTodayUsd: 55 } };
    expect(checkQuota(critical, 10).allowed).toBe(true);
  });

  it("rejects background tier with quota exhausted", () => {
    const bg = { ...baseAgent, priorityTier: "background" as const, quota: { dailyCapUsd: 50, usedTodayUsd: 50 } };
    expect(checkQuota(bg, 5).allowed).toBe(false);
  });

  it("rejects standard tier with quota exhausted", () => {
    const exhausted = { ...baseAgent, quota: { dailyCapUsd: 50, usedTodayUsd: 50 } };
    expect(checkQuota(exhausted, 5).allowed).toBe(false);
  });
});

describe("checkModelAccess — DLP gate", () => {
  it("allows internal clearance on closed model", () => {
    expect(checkModelAccess(baseAgent, "claude-sonnet-4-20250514").allowed).toBe(true);
  });

  it("blocks confidential clearance on closed model", () => {
    const confAgent = { ...baseAgent, classificationClearance: "confidential" as const };
    const r = checkModelAccess(confAgent, "claude-sonnet-4-20250514");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("classification_gate");
  });

  it("allows confidential clearance on self-hosted model", () => {
    const confAgent = { ...baseAgent, classificationClearance: "confidential" as const };
    expect(checkModelAccess(confAgent, "glm-5.2").allowed).toBe(true);
  });
});
