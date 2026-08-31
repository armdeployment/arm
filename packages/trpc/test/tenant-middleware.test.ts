/**
 * tRPC router tests — tenant middleware + scope-aware queries.
 *
 * Uses the manufacturing company fixture data:
 *   10 departments, 60 agents, $16,170/mo total spend
 */

import { describe, it, expect } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";

const authedClaims: ARMClaims = { sub: "user_01", tenant_id: "tn_01", email: "eng@acme.com" };
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

describe("tenant middleware (Invariant §11.6)", () => {
  it("REJECTS unauthenticated requests", async () => {
    await expect(caller(null).orgTree.children({ scope: null })).rejects.toThrowError(
      /No authenticated tenant context/,
    );
  });
  it("ALLOWS authenticated requests", async () => {
    const r = await caller(authedClaims).orgTree.children({ scope: null });
    expect(r.tenantId).toBe("tn_01");
  });
});

describe("org tree (manufacturing company)", () => {
  it("org root returns 10 departments as children", async () => {
    const r = await caller(authedClaims).orgTree.children({ scope: null });
    expect(r.scope.name).toBe("Acme Manufacturing");
    expect(r.children.length).toBe(10);
    expect(r.children.map((c) => c.name)).toContain("Manufacturing");
    expect(r.children.map((c) => c.name)).toContain("Quality Assurance");
    expect(r.children.map((c) => c.name)).toContain("Supply Chain");
  });

  it("Engineering dept returns Product Design + Tooling groups", async () => {
    const r = await caller(authedClaims).orgTree.children({
      scope: { type: "department", id: "dept_eng" },
    });
    expect(r.children.map((c) => c.name).sort()).toEqual(["Product Design", "Tooling"]);
  });

  it("Engineering spend rollup is $1,800", async () => {
    const r = await caller(authedClaims).orgTree.children({ scope: null });
    const eng = r.children.find((c: any) => c.name === "Engineering")!;
    // CAD (420+280=700) + Simulation (350+180=530) + Tool Design (310+260=570)
    // Product Design (700+530=1230) + Tooling (570) = 1800
    expect(eng.monthlySpend).toBe(1800);
    expect(eng.agentCount).toBe(6);
  });

  it("breadcrumb path from a team is correct", async () => {
    const r = await caller(authedClaims).orgTree.path({
      scope: { type: "team", id: "team_cad" },
    });
    expect(r.path.map((p) => p.name)).toEqual([
      "Acme Manufacturing",
      "Engineering",
      "Product Design",
      "CAD Design",
    ]);
  });

  it("fullTree returns complete hierarchy", async () => {
    const r = await caller(authedClaims).orgTree.fullTree();
    expect(r.tree.name).toBe("Acme Manufacturing");
    expect(r.tree.monthlySpend).toBe(16170);
    expect(r.tree.agentCount).toBe(60);
    expect(r.tree.children.length).toBe(10);
  });

  it("each department in fullTree has correct rollups", async () => {
    const r = await caller(authedClaims).orgTree.fullTree();
    const mfg = r.tree.children.find((c: any) => c.name === "Manufacturing")!;
    // Line A (890+720=1610) + Line B (560+340=900) + Predictive Maint (380+150=530)
    // Production (2510) + Maintenance (530) = 3040
    expect(mfg.monthlySpend).toBe(3040);
    expect(mfg.agentCount).toBe(6);
    expect(mfg.children.length).toBe(2); // Production + Maintenance
  });

  it("team-level critical counts are accurate", async () => {
    const r = await caller(authedClaims).orgTree.fullTree();
    const qa = r.tree.children.find((c: any) => c.name === "Quality Assurance")!;
    const insp = qa.children.find((c: any) => c.name === "Inspection")!;
    const finalQc = insp.children.find((c: any) => c.name === "Final QC")!;
    expect(finalQc.criticalCount).toBe(1); // visual-inspector
  });
});

describe("scope-aware spend summary", () => {
  it("org-level: $16,170 total, 60 agents", async () => {
    const r = await caller(authedClaims).spend.summary({ scope: null });
    expect(r.scope.name).toBe("Acme Manufacturing");
    expect(r.totalMonthlySpend).toBe(16170);
    expect(r.agentCount).toBe(60);
  });

  it("Supply Chain dept: $1,310 spend, 6 agents", async () => {
    const r = await caller(authedClaims).spend.summary({
      scope: { type: "department", id: "dept_sc" },
    });
    expect(r.scope.name).toBe("Supply Chain");
    expect(r.totalMonthlySpend).toBe(1310);
    expect(r.agentCount).toBe(6);
  });

  it("budget utilization varies by department", async () => {
    const mfg = await caller(authedClaims).spend.summary({
      scope: { type: "department", id: "dept_mfg" },
    });
    const hr = await caller(authedClaims).spend.summary({
      scope: { type: "department", id: "dept_hr" },
    });
    expect(mfg.budgetUtilPct).toBeGreaterThan(0);
    expect(hr.budgetUtilPct).toBeGreaterThan(0);
  });
});

describe("scope-aware agents list", () => {
  it("org scope returns all 60 agents", async () => {
    const r = await caller(authedClaims).agents.list({ scope: null, status: "all" });
    expect(r.agents.length).toBe(60);
  });

  it("a team returns only that team's agents", async () => {
    const r = await caller(authedClaims).agents.list({
      scope: { type: "team", id: "team_line_a" },
      status: "all",
    });
    expect(r.agents.length).toBe(2);
    expect(
      r.agents.every((a: any) => a.name.includes("monitor") || a.name.includes("detector")),
    ).toBe(true);
  });
});

describe("input validation", () => {
  it("rejects invalid agent creation input", async () => {
    await expect(
      caller(authedClaims).agents.create({
        name: "",
        scopeType: "org",
        scopeId: "bad-uuid",
        stakeholderUserId: "bad-uuid",
        type: "test",
      }),
    ).rejects.toThrow();
  });
});
