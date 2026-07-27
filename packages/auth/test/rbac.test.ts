/**
 * Auth package tests: RBAC permission checking + token shape validation.
 *
 * Token verification (jose/JWKS) requires a live IdP — those are integration
 * tests that land in 1.3 (live Okta/Entra). These unit tests cover the
 * pure-logic RBAC helpers and the token payload builder.
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  buildAgentTokenPayload,
  armClaimsSchema,
  type ResolvedRole,
} from "../src/index.js";

describe("RBAC — hasPermission", () => {
  const adminRole: ResolvedRole = { name: "admin", permissions: ["*"] };
  const agentRole: ResolvedRole = { name: "agent-mgr", permissions: ["agent:create", "agent:read", "agent:disable"] };
  const budgetRole: ResolvedRole = { name: "budget-viewer", permissions: ["budget:read"] };

  it("grants exact permission match", () => {
    expect(hasPermission([agentRole], "agent:create")).toBe(true);
  });

  it("denies when permission not in any role", () => {
    expect(hasPermission([budgetRole], "agent:create")).toBe(false);
  });

  it("grants via wildcard (*)", () => {
    expect(hasPermission([adminRole], "anything:whatever")).toBe(true);
  });

  it("grants via resource wildcard (resource:*)", () => {
    const role: ResolvedRole = { name: "r", permissions: ["agent:*"] };
    expect(hasPermission([role], "agent:create")).toBe(true);
    expect(hasPermission([role], "budget:read")).toBe(false);
  });

  it("checks across multiple roles", () => {
    expect(hasPermission([agentRole, budgetRole], "budget:read")).toBe(true);
    expect(hasPermission([agentRole, budgetRole], "budget:write")).toBe(false);
  });
});

describe("RBAC — hasAllPermissions (AND)", () => {
  const role: ResolvedRole = { name: "r", permissions: ["agent:read", "agent:create"] };

  it("passes when all permissions present", () => {
    expect(hasAllPermissions([role], ["agent:read", "agent:create"])).toBe(true);
  });

  it("fails when any permission missing", () => {
    expect(hasAllPermissions([role], ["agent:read", "budget:read"])).toBe(false);
  });
});

describe("RBAC — hasAnyPermission (OR)", () => {
  const role: ResolvedRole = { name: "r", permissions: ["agent:read"] };

  it("passes when any permission present", () => {
    expect(hasAnyPermission([role], ["agent:read", "budget:write"])).toBe(true);
  });

  it("fails when no permissions present", () => {
    expect(hasAnyPermission([role], ["budget:read", "budget:write"])).toBe(false);
  });
});

describe("Agent token payload builder", () => {
  it("produces a valid ARMClaims-compatible payload", () => {
    const payload = buildAgentTokenPayload({
      agentId: "agt_01",
      subAccountId: "sa_01",
      tenantId: "tn_01",
      priorityTier: "critical",
      scope: "s3:read bucket:data",
      ttlSeconds: 900,
    });
    // Should parse against the claims schema.
    expect(() => armClaimsSchema.parse(payload)).not.toThrow();
  });

  it("sets expiry based on TTL", () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = buildAgentTokenPayload({
      agentId: "agt_01",
      subAccountId: "sa_01",
      tenantId: "tn_01",
      priorityTier: "standard",
      scope: "db:read",
      ttlSeconds: 300,
    });
    const exp = payload.exp!;
    expect(exp).toBeGreaterThanOrEqual(before + 299);
    expect(exp).toBeLessThanOrEqual(before + 301);
  });
});
