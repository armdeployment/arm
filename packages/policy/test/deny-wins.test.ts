/**
 * Deny-wins property-based tests (spec §11.3, §14.1).
 *
 * Uses fast-check to generate randomized scope trees with deny injection,
 * asserting deny-wins on every path. This is the property test mandated by
 * §14.1 for Invariant §11.3.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveAccess,
  resolveLLMModel,
  SCOPE_RANK,
  type Grant,
  type ScopeType,
} from "../src/index.js";

const SCOPES: ScopeType[] = ["org", "department", "group", "team", "workstream"];

describe("resolveAccess — basic semantics", () => {
  it("denies by default when no grants exist", () => {
    const r = resolveAccess({
      grants: [],
      principalId: "p1",
      resourceId: "r1",
      action: "read",
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("no_matching_grant");
  });

  it("allows when a matching allow grant exists", () => {
    const grant: Grant = {
      scopeType: "team",
      scopeId: "t1",
      principalId: "p1",
      resourceId: "r1",
      actions: ["read"],
      deny: false,
    };
    const r = resolveAccess({
      grants: [grant],
      principalId: "p1",
      resourceId: "r1",
      action: "read",
    });
    expect(r.decision).toBe("allow");
  });

  it("denies when a matching deny grant exists at the same level", () => {
    const grants: Grant[] = [
      {
        scopeType: "team",
        scopeId: "t1",
        principalId: "p1",
        resourceId: "r1",
        actions: ["read"],
        deny: false,
      },
      {
        scopeType: "team",
        scopeId: "t1",
        principalId: "p1",
        resourceId: "r1",
        actions: ["read"],
        deny: true,
      },
    ];
    const r = resolveAccess({
      grants,
      principalId: "p1",
      resourceId: "r1",
      action: "read",
    });
    expect(r.decision).toBe("deny");
  });

  it("ignores expired grants", () => {
    const grant: Grant = {
      scopeType: "team",
      scopeId: "t1",
      principalId: "p1",
      resourceId: "r1",
      actions: ["read"],
      deny: false,
      expiresAt: "2020-01-01T00:00:00Z",
    };
    const r = resolveAccess({
      grants: [grant],
      principalId: "p1",
      resourceId: "r1",
      action: "read",
      now: new Date("2026-07-27"),
    });
    expect(r.decision).toBe("deny");
  });

  it("supports wildcard action (*)", () => {
    const grant: Grant = {
      scopeType: "org",
      scopeId: "o1",
      principalId: "p1",
      resourceId: "r1",
      actions: ["*"],
      deny: false,
    };
    const r = resolveAccess({
      grants: [grant],
      principalId: "p1",
      resourceId: "r1",
      action: "delete",
    });
    expect(r.decision).toBe("allow");
  });
});

describe("Invariant §11.3 — deny-wins property tests (fast-check)", () => {
  // Generate a random grant at a random scope level.
  const grantArbitrary = fc.record({
    scopeType: fc.constantFrom(...SCOPES),
    scopeId: fc.string({ minLength: 1, maxLength: 5 }),
    principalId: fc.constant("p1"),
    resourceId: fc.constant("r1"),
    actions: fc.constant(["read"] as string[]),
    deny: fc.boolean(),
  });

  it("a higher-level deny ALWAYS overrides any lower-level allow", () => {
    fc.assert(
      fc.property(fc.array(grantArbitrary, { minLength: 1, maxLength: 20 }), (grants) => {
        // Inject a deny at the highest authority (org level)
        const injectedDeny: Grant = {
          scopeType: "org",
          scopeId: "root",
          principalId: "p1",
          resourceId: "r1",
          actions: ["read"],
          deny: true,
        };
        const allGrants = [...grants, injectedDeny];

        const result = resolveAccess({
          grants: allGrants,
          principalId: "p1",
          resourceId: "r1",
          action: "read",
        });

        // The org-level deny must always win, regardless of other grants.
        expect(result.decision).toBe("deny");
      }),
      { numRuns: 200 },
    );
  });

  it("deny at level N cannot be overridden by allow at level > N", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SCOPES),
        fc.array(grantArbitrary, { minLength: 0, maxLength: 15 }),
        (denyLevel, otherGrants) => {
          const denyGrant: Grant = {
            scopeType: denyLevel,
            scopeId: "scope",
            principalId: "p1",
            resourceId: "r1",
            actions: ["read"],
            deny: true,
          };
          // All other grants are at LOWER authority (higher rank number).
          const lowerAllows: Grant[] = otherGrants
            .filter((g) => !g.deny && SCOPE_RANK[g.scopeType] > SCOPE_RANK[denyLevel])
            .map((g) => ({ ...g, deny: false }));

          const result = resolveAccess({
            grants: [denyGrant, ...lowerAllows],
            principalId: "p1",
            resourceId: "r1",
            action: "read",
          });

          expect(result.decision).toBe("deny");
        },
      ),
      { numRuns: 200 },
    );
  });

  it("if only allows exist (no deny), the result is always allow", () => {
    fc.assert(
      fc.property(
        fc
          .array(grantArbitrary, { minLength: 1, maxLength: 10 })
          .map((gs) => gs.map((g) => ({ ...g, deny: false }))),
        (allows) => {
          const result = resolveAccess({
            grants: allows,
            principalId: "p1",
            resourceId: "r1",
            action: "read",
          });
          expect(result.decision).toBe("allow");
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("resolveLLMModel — model routing policy", () => {
  it("allows when model is in the policy", () => {
    const r = resolveLLMModel(
      [{ scopeType: "org", scopeId: "o1", allowedModels: ["claude-sonnet-4.5", "gpt-4o"] }],
      "claude-sonnet-4.5",
      "workstream",
      "w1",
    );
    expect(r.allowed).toBe(true);
  });

  it("denies and suggests downgrade when model not allowed", () => {
    const r = resolveLLMModel(
      [
        {
          scopeType: "org",
          scopeId: "o1",
          allowedModels: ["glm-5.2"],
          autoDowngradeTo: "glm-5.2",
        },
      ],
      "claude-sonnet-4.5",
      "workstream",
      "w1",
    );
    expect(r.allowed).toBe(false);
    expect(r.model).toBe("glm-5.2");
  });

  it("denies when no applicable policy exists", () => {
    const r = resolveLLMModel([], "claude-sonnet-4.5", "workstream", "w1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no_applicable_policy");
  });
});

describe("DLP content hooks", () => {
  it("PII hook detects SSN pattern", async () => {
    const { DLP_HOOKS } = await import("../src/index.js");
    const piiHook = DLP_HOOKS.find((h) => h.name === "pii_detection")!;
    expect(piiHook).toBeDefined();
    expect(piiHook.scan("hello world").matched).toBe(false);
    expect(piiHook.scan("SSN: 123-45-6789").matched).toBe(true);
  });

  it("API key hook detects Anthropic keys", async () => {
    const { DLP_HOOKS } = await import("../src/index.js");
    const keyHook = DLP_HOOKS.find((h) => h.name === "api_key_leakage")!;
    expect(keyHook.scan("const key = 'sk-ant-api03-xxx'").matched).toBe(true);
  });
});
