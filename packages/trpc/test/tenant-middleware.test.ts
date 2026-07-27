/**
 * tRPC router tests — tenant middleware + scope-aware queries.
 *
 * Verifies:
 *   - Unauthenticated requests are rejected (no tenant context = UNAUTHORIZED).
 *   - Authenticated requests get tenantId stamped into context.
 *   - Scope queries return hierarchical data (drill-down).
 *   - Input validation (zod) works on procedures.
 */

import { describe, it, expect } from "vitest";
import { createContext, appRouter, type AppRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";

const authedClaims: ARMClaims = {
  sub: "user_01",
  tenant_id: "tn_01",
  email: "eng@acme.com",
};

function makeCaller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

describe("tenant middleware (Invariant §11.6)", () => {
  it("REJECTS unauthenticated requests to protected procedures", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.orgTree.children({ scope: null }),
    ).rejects.toThrowError(/No authenticated tenant context/);
  });

  it("ALLOWS authenticated requests with tenant context", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.children({ scope: null });
    expect(result.tenantId).toBe("tn_01");
  });

  it("stamps tenantId into every procedure context", async () => {
    const caller = makeCaller(authedClaims);
    const spend = await caller.spend.summary({ scope: null });
    expect(spend.tenantId).toBe("tn_01");
  });
});

describe("public procedures (no auth required)", () => {
  it("health check works without auth", async () => {
    const caller = makeCaller(null);
    const result = await caller.health.check();
    expect(result.status).toBe("ok");
  });
});

describe("org-tree drill-down (§6.1 hierarchy)", () => {
  it("org root returns 3 departments as children", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.children({ scope: null });
    expect(result.scope.type).toBe("org");
    expect(result.children.length).toBe(3);
    expect(result.children.map((c) => c.name)).toContain("Engineering");
    expect(result.children.map((c) => c.name)).toContain("Operations");
    expect(result.children.map((c) => c.name)).toContain("Data");
  });

  it("Engineering dept returns Platform + Product Eng groups", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.children({
      scope: { type: "department", id: "dept_eng" },
    });
    expect(result.children.map((c) => c.name).sort()).toEqual(["Platform", "Product Eng"]);
  });

  it("child spend rollups are correct", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.children({ scope: null });
    const eng = result.children.find((c) => c.name === "Engineering")!;
    // Backend (890+430+380+95=1795) + Frontend (320+210+140=670) +
    // Mobile (350+110=460) + Design Systems (130+280=410) = 3335
    expect(eng.monthlySpend).toBe(3335);
    expect(eng.agentCount).toBe(11);
  });

  it("breadcrumb path resolves from root to team", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.path({
      scope: { type: "team", id: "team_be" },
    });
    expect(result.path.map((p) => p.name)).toEqual([
      "Acme Corp", "Engineering", "Platform", "Backend",
    ]);
  });
});

describe("scope-aware spend summary", () => {
  it("org-level summary rolls up all agents", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.spend.summary({ scope: null });
    expect(result.scope.type).toBe("org");
    expect(result.agentCount).toBe(18);
    expect(result.totalMonthlySpend).toBe(7150);
  });

  it("department-level summary only counts that dept's agents", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.spend.summary({
      scope: { type: "department", id: "dept_ops" },
    });
    expect(result.scope.name).toBe("Operations");
    expect(result.agentCount).toBe(5);
  });

  it("budget utilization is computed per scope", async () => {
    const caller = makeCaller(authedClaims);
    const org = await caller.spend.summary({ scope: null });
    const ops = await caller.spend.summary({
      scope: { type: "department", id: "dept_ops" },
    });
    // Different scopes have different budgets
    expect(org.budgetCap).not.toBe(ops.budgetCap);
    expect(ops.budgetUtilPct).toBeGreaterThan(0);
  });
});

describe("scope-aware agents list", () => {
  it("org scope returns all agents", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.agents.list({ scope: null, status: "all" });
    expect(result.agents.length).toBe(18);
  });

  it("team scope returns only that team's agents", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.agents.list({
      scope: { type: "team", id: "team_ir" },
      status: "all",
    });
    expect(result.agents.length).toBe(3);
    expect(result.agents.every((a) => a.scope === "Incident Response")).toBe(true);
  });

  it("agents include taskType field", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.agents.list({ scope: null, status: "all" });
    expect(result.agents[0]!.taskType).toBeTruthy();
  });
});

describe("org-tree full tree (management visualization)", () => {
  it("returns the complete tree with rollups at every level", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.fullTree();
    expect(result.tree.name).toBe("Acme Corp");
    expect(result.tree.monthlySpend).toBe(7150);
    expect(result.tree.agentCount).toBe(18);
    expect(result.tree.children.length).toBe(3); // 3 departments
  });

  it("each department node has its own rollup", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.fullTree();
    const eng = result.tree.children.find((c) => c.name === "Engineering")!;
    expect(eng.monthlySpend).toBe(3335);
    expect(eng.agentCount).toBe(11);
    expect(eng.children.length).toBe(2); // Platform + Product Eng
  });

  it("team-level nodes carry task agents", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.fullTree();
    const ops = result.tree.children.find((c) => c.name === "Operations")!;
    const sre = ops.children.find((c) => c.name === "SRE")!;
    const ir = sre.children.find((c) => c.name === "Incident Response")!;
    expect(ir.monthlySpend).toBe(3160); // 1580+1240+340
    expect(ir.criticalCount).toBe(2);
  });

  it("budget utilization is computed per node", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.orgTree.fullTree();
    for (const child of result.tree.children) {
      expect(child.budgetUtilPct).toBeGreaterThan(0);
      expect(child.budgetCap).toBeGreaterThan(0);
    }
  });
});

describe("input validation (zod)", () => {
  it("rejects invalid agent creation input", async () => {
    const caller = makeCaller(authedClaims);
    await expect(
      caller.agents.create({
        name: "",
        scopeType: "org",
        scopeId: "not-a-uuid",
        stakeholderUserId: "also-not-uuid",
        type: "test",
      }),
    ).rejects.toThrow();
  });
});
