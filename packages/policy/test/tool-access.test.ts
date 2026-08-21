/**
 * D9 per-tool authorization tests (docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Covers: deny-override ranked by TOOL_SCOPE_RANK, action wildcards, default
 * deny, scope-rank integrity (shared SCOPE_RANK: org..workstream values
 * frozen, plant outranks department), package model routing (allowlist /
 * downgrade / prefix match / passthrough / block), and the Invariant §11.3
 * deny-wins property test.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveToolAccess,
  resolvePackageModel,
  SCOPE_RANK,
  TOOL_SCOPE_RANK,
  TOOL_ACTION_VERBS,
  toolVerbFor,
  type ToolGrant,
  type ToolAction,
  type ScopeType,
} from "../src/index.js";

const TOOL_SCOPES: ScopeType[] = Object.keys(TOOL_SCOPE_RANK) as ScopeType[];

function grant(partial: Partial<ToolGrant> & Pick<ToolGrant, "scopeType" | "deny">): ToolGrant {
  return {
    scopeId: "s1",
    principalId: "p1",
    toolId: "t1",
    action: "invoke",
    ...partial,
  };
}

describe("resolveToolAccess — basic semantics", () => {
  it("denies by default when no grants exist (reason no_matching_tool_grant)", () => {
    const r = resolveToolAccess({
      grants: [],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("no_matching_tool_grant");
    expect(r.matchedGrant).toBeUndefined();
  });

  it("allows when a matching allow grant exists", () => {
    const r = resolveToolAccess({
      grants: [grant({ scopeType: "team", deny: false })],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
    });
    expect(r.decision).toBe("allow");
    expect(r.reason).toBe("granted_at_team");
    expect(r.matchedGrant).toBeDefined();
  });

  it("denies when a matching deny grant exists at the same level", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "team", deny: false }),
      grant({ scopeType: "team", deny: true }),
    ];
    const r = resolveToolAccess({ grants, principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("higher_level_deny_at_team");
  });

  it("ignores expired grants", () => {
    const g = grant({
      scopeType: "team",
      deny: false,
      expiresAt: "2020-01-01T00:00:00Z",
    });
    const r = resolveToolAccess({
      grants: [g],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
      now: new Date("2026-07-27"),
    });
    expect(r.decision).toBe("deny");
  });

  it("ignores expired DENY grants (allow can win)", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "team", deny: false }),
      grant({
        scopeType: "org",
        deny: true,
        expiresAt: "2020-01-01T00:00:00Z",
      }),
    ];
    const r = resolveToolAccess({
      grants,
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
      now: new Date("2026-07-27"),
    });
    expect(r.decision).toBe("allow");
  });

  it("supports wildcard action (*)", () => {
    const g = grant({ scopeType: "org", deny: false, action: "*" });
    const r = resolveToolAccess({ grants: [g], principalId: "p1", toolId: "t1", action: "publish" });
    expect(r.decision).toBe("allow");
  });

  it("action mismatch → deny", () => {
    const g = grant({ scopeType: "team", deny: false, action: "configure" });
    const r = resolveToolAccess({ grants: [g], principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("no_matching_tool_grant");
  });

  it("principal mismatch → deny", () => {
    const g = grant({ scopeType: "team", deny: false, principalId: "other" });
    const r = resolveToolAccess({ grants: [g], principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
  });
});

describe("resolveToolAccess — deny-override (Invariant §11.3)", () => {
  it("org-level deny beats workstream-level allow", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "workstream", deny: false }),
      grant({ scopeType: "org", deny: true }),
    ];
    const r = resolveToolAccess({ grants, principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("higher_level_deny_at_org");
    expect(r.matchedGrant?.scopeType).toBe("org");
  });

  it("plant deny beats department allow (plant outranks department)", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "department", deny: false }),
      grant({ scopeType: "plant", deny: true }),
    ];
    const r = resolveToolAccess({ grants, principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
    expect(r.matchedGrant?.scopeType).toBe("plant");
  });

  it("workstream allow does NOT beat line deny (deeper scopes rank lower)", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "line", deny: true }),
      grant({ scopeType: "workstream", deny: false }),
    ];
    const r = resolveToolAccess({ grants, principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
    expect(r.matchedGrant?.scopeType).toBe("line");
  });

  it("wildcard-action deny also overrides", () => {
    const grants: ToolGrant[] = [
      grant({ scopeType: "workstream", deny: false }),
      grant({ scopeType: "org", deny: true, action: "*" }),
    ];
    const r = resolveToolAccess({ grants, principalId: "p1", toolId: "t1", action: "invoke" });
    expect(r.decision).toBe("deny");
  });
});

describe("scope ranks", () => {
  it("SCOPE_RANK keeps original org..workstream values", () => {
    const legacy: Record<string, number> = {
      org: 0,
      department: 1,
      group: 2,
      team: 3,
      workstream: 4,
    };
    for (const [k, v] of Object.entries(legacy)) {
      expect(SCOPE_RANK[k as ScopeType]).toBe(v);
    }
  });

  it("TOOL_SCOPE_RANK preserves all SCOPE_RANK values", () => {
    for (const [k, v] of Object.entries(SCOPE_RANK)) {
      expect(TOOL_SCOPE_RANK[k as ScopeType]).toBe(v);
    }
  });

  it("plant (0.5) outranks department (1)", () => {
    expect(TOOL_SCOPE_RANK["plant"]!).toBeLessThan(TOOL_SCOPE_RANK["department"]!);
  });

  it("manufacturing scopes order: org < plant < department < group < team < workstream < line < cell < station", () => {
    const order: ScopeType[] = [
      "org",
      "plant",
      "department",
      "group",
      "team",
      "workstream",
      "line",
      "cell",
      "station",
    ];
    for (let i = 1; i < order.length; i++) {
      expect(TOOL_SCOPE_RANK[order[i - 1]!]!).toBeLessThan(TOOL_SCOPE_RANK[order[i]!]!);
    }
  });
});

describe("tool verbs", () => {
  it("TOOL_ACTION_VERBS are the three tool:* verbs", () => {
    expect(TOOL_ACTION_VERBS).toEqual(["tool:invoke", "tool:configure", "tool:publish"]);
  });

  it("toolVerbFor maps each ToolAction", () => {
    const expected: Record<ToolAction, string> = {
      invoke: "tool:invoke",
      configure: "tool:configure",
      publish: "tool:publish",
    };
    for (const [action, verb] of Object.entries(expected) as [ToolAction, string][]) {
      expect(toolVerbFor(action)).toBe(verb);
    }
    expect((TOOL_ACTION_VERBS as readonly string[])).toContain(toolVerbFor("invoke"));
  });
});

describe("resolvePackageModel — package model routing", () => {
  it("undefined routing → passthrough with reason no_package_routing", () => {
    const r = resolvePackageModel(undefined, "claude-sonnet-4.5");
    expect(r).toEqual({
      model: "claude-sonnet-4.5",
      downgraded: false,
      reason: "no_package_routing",
    });
  });

  it("allowlist match → model as-is", () => {
    const r = resolvePackageModel(
      { allowed_models: ["claude-sonnet-4.5", "gpt-4o"] },
      "claude-sonnet-4.5",
    );
    expect(r).toEqual({
      model: "claude-sonnet-4.5",
      downgraded: false,
      reason: "package_policy_allowed",
    });
  });

  it("allowlist mismatch + auto_downgrade_to → downgrade", () => {
    const r = resolvePackageModel(
      { allowed_models: ["glm-5.2"], auto_downgrade_to: "glm-5.2" },
      "claude-sonnet-4.5",
    );
    expect(r).toEqual({
      model: "glm-5.2",
      downgraded: true,
      reason: "package_policy_downgrade",
    });
  });

  it("prefix matching: self_hosted/* allows self_hosted/llama-3", () => {
    const r = resolvePackageModel(
      { allowed_models: ["self_hosted/*"] },
      "self_hosted/llama-3",
    );
    expect(r.model).toBe("self_hosted/llama-3");
    expect(r.downgraded).toBe(false);
  });

  it("prefix matching: self_hosted/* rejects openai/gpt-4o", () => {
    const r = resolvePackageModel(
      { allowed_models: ["self_hosted/*"], auto_downgrade_to: "self_hosted/llama-3" },
      "openai/gpt-4o",
    );
    expect(r.model).toBe("self_hosted/llama-3");
    expect(r.downgraded).toBe(true);
    expect(r.reason).toBe("package_policy_downgrade");
  });

  it("wildcard * allows any model", () => {
    const r = resolvePackageModel({ allowed_models: ["*"] }, "anything-goes");
    expect(r.downgraded).toBe(false);
    expect(r.model).toBe("anything-goes");
  });

  it("no-fallback violation → returns requested model with reason package_policy_block (no throw)", () => {
    const r = resolvePackageModel(
      { allowed_models: ["glm-5.2"] },
      "claude-sonnet-4.5",
    );
    expect(r).toEqual({
      model: "claude-sonnet-4.5",
      downgraded: false,
      reason: "package_policy_block",
    });
  });

  it("accepts tier option without changing allowlist behavior", () => {
    const r = resolvePackageModel(
      { allowed_models: ["glm-5.2"] },
      "glm-5.2",
      { tier: "critical" },
    );
    expect(r.reason).toBe("package_policy_allowed");
  });
});

describe("Invariant §11.3 — resolveToolAccess deny-wins property test (fast-check)", () => {
  const actionArb = fc.constantFrom<ToolAction>("invoke", "configure", "publish");

  const grantArbitrary: fc.Arbitrary<ToolGrant> = fc
    .record({
      scopeType: fc.constantFrom(...TOOL_SCOPES),
      scopeId: fc.string({ minLength: 1, maxLength: 5 }),
      principalId: fc.constantFrom("p1", "p2"),
      toolId: fc.constantFrom("t1", "t2"),
      action: fc.constantFrom<"invoke" | "configure" | "publish" | "*">(
        "invoke",
        "configure",
        "publish",
        "*",
      ),
      deny: fc.boolean(),
    })
    .chain((base) =>
      fc.boolean().map<ToolGrant>((expired) =>
        expired ? { ...base, expiresAt: "2020-01-01T00:00:00Z" } : { ...base },
      ),
    );

  it("never allows when any unexpired matching deny exists", () => {
    fc.assert(
      fc.property(
        fc.array(grantArbitrary, { minLength: 0, maxLength: 20 }),
        actionArb,
        (grants, action) => {
          const result = resolveToolAccess({
            grants,
            principalId: "p1",
            toolId: "t1",
            action,
            now: new Date("2026-07-27"),
          });

          const matchingUnexpiredDeny = grants.some(
            (g) =>
              g.principalId === "p1" &&
              g.toolId === "t1" &&
              (g.action === "*" || g.action === action) &&
              g.deny &&
              (g.expiresAt === undefined ||
                new Date(g.expiresAt) >= new Date("2026-07-27")),
          );

          if (matchingUnexpiredDeny) {
            expect(result.decision).toBe("deny");
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("result is allow only when at least one unexpired matching allow exists and no unexpired matching deny", () => {
    fc.assert(
      fc.property(
        fc.array(grantArbitrary, { minLength: 0, maxLength: 20 }),
        (grants) => {
          const now = new Date("2026-07-27");
          const result = resolveToolAccess({
            grants,
            principalId: "p1",
            toolId: "t1",
            action: "invoke",
            now,
          });

          const matchingUnexpired = (predicate: (g: ToolGrant) => boolean) =>
            grants.some(
              (g) =>
                g.principalId === "p1" &&
                g.toolId === "t1" &&
                (g.action === "*" || g.action === "invoke") &&
                (g.expiresAt === undefined || new Date(g.expiresAt) >= now) &&
                predicate(g),
            );

          if (result.decision === "allow") {
            expect(matchingUnexpired((g) => !g.deny)).toBe(true);
            expect(matchingUnexpired((g) => g.deny)).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
