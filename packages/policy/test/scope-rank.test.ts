/**
 * Shared scope-rank map tests (finding M6: divergent scope-rank maps).
 *
 * packages/policy/src/scope-rank.ts is the single source of truth for scope
 * authority ranks; resolveAccess and resolveToolAccess must agree on the
 * same grant. Covers: plant-level deny beats team-level allow in
 * resolveAccess, cross-resolver consistency, unknown scope types ranking
 * last, and frozen legacy org..workstream values.
 */

import { describe, it, expect } from "vitest";
import {
  resolveAccess,
  resolveToolAccess,
  SCOPE_RANK,
  TOOL_SCOPE_RANK,
  type Grant,
  type ScopeType,
  type ToolGrant,
} from "../src/index.js";

const ALL_SCOPES: ScopeType[] = [
  "org",
  "organization",
  "hq",
  "plant",
  "department",
  "group",
  "team",
  "workstream",
  "line",
  "cell",
  "station",
];

function resourceGrant(scopeType: ScopeType, deny: boolean): Grant {
  return {
    scopeType,
    scopeId: "s1",
    principalId: "p1",
    resourceId: "r1",
    actions: ["read"],
    deny,
  };
}

function toolGrant(scopeType: ScopeType, deny: boolean): ToolGrant {
  return {
    scopeType,
    scopeId: "s1",
    principalId: "p1",
    toolId: "t1",
    action: "invoke",
    deny,
  };
}

describe("shared scope rank — resolveAccess", () => {
  it("plant-level deny beats team-level allow (higher authority)", () => {
    expect(SCOPE_RANK["plant"]).toBeLessThan(SCOPE_RANK["team"]);

    const r = resolveAccess({
      grants: [resourceGrant("team", false), resourceGrant("plant", true)],
      principalId: "p1",
      resourceId: "r1",
      action: "read",
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("higher_level_deny_at_plant");
    expect(r.matchedGrant?.scopeType).toBe("plant");
  });

  it("known scope types never rank NaN in resolveAccess", () => {
    const r = resolveAccess({
      grants: [resourceGrant("station", true), resourceGrant("team", false)],
      principalId: "p1",
      resourceId: "r1",
      action: "read",
    });
    expect(r.decision).toBe("deny");
    expect(r.matchedGrant?.scopeType).toBe("station");
  });
});

describe("shared scope rank — cross-resolver consistency", () => {
  it("resolveToolAccess and resolveAccess agree for every scope pair", () => {
    for (const denyScope of ALL_SCOPES) {
      for (const allowScope of ALL_SCOPES) {
        const resource = resolveAccess({
          grants: [resourceGrant(denyScope, true), resourceGrant(allowScope, false)],
          principalId: "p1",
          resourceId: "r1",
          action: "read",
        });
        const tool = resolveToolAccess({
          grants: [toolGrant(denyScope, true), toolGrant(allowScope, false)],
          principalId: "p1",
          toolId: "t1",
          action: "invoke",
        });

        expect(tool.decision).toBe(resource.decision);
        expect(tool.reason).toBe(resource.reason);
        expect(tool.matchedGrant?.scopeType).toBe(resource.matchedGrant?.scopeType);

        // Deny always wins (Invariant §11.3), and the matched grant is the
        // deny grant at the deny scope.
        expect(resource.decision).toBe("deny");
        expect(resource.matchedGrant!.scopeType).toBe(denyScope);
      }
    }
  });
});

describe("shared scope rank — unknown scope types rank last", () => {
  const UNKNOWN = "mystery" as ScopeType;

  it("a known allow beats an unknown-scope allow", () => {
    const r = resolveToolAccess({
      grants: [toolGrant(UNKNOWN, false), toolGrant("team", false)],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
    });
    expect(r.decision).toBe("allow");
    expect(r.matchedGrant?.scopeType).toBe("team");
  });

  it("a known deny beats an unknown-scope deny", () => {
    const r = resolveToolAccess({
      grants: [toolGrant(UNKNOWN, true), toolGrant("team", true)],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
    });
    expect(r.decision).toBe("deny");
    expect(r.matchedGrant?.scopeType).toBe("team");
  });

  it("an unknown-scope deny still overrides any allow (deny-wins)", () => {
    const r = resolveToolAccess({
      grants: [toolGrant("team", false), toolGrant(UNKNOWN, true)],
      principalId: "p1",
      toolId: "t1",
      action: "invoke",
    });
    expect(r.decision).toBe("deny");
    expect(r.matchedGrant?.scopeType).toBe(UNKNOWN);
  });
});

describe("shared scope rank — frozen legacy values", () => {
  it("SCOPE_RANK keeps original org..workstream values", () => {
    expect(SCOPE_RANK["org"]).toBe(0);
    expect(SCOPE_RANK["department"]).toBe(1);
    expect(SCOPE_RANK["group"]).toBe(2);
    expect(SCOPE_RANK["team"]).toBe(3);
    expect(SCOPE_RANK["workstream"]).toBe(4);
  });

  it("TOOL_SCOPE_RANK is the same map (single source of truth)", () => {
    expect(TOOL_SCOPE_RANK).toBe(SCOPE_RANK);
  });
});
