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
  const agentRole: ResolvedRole = {
    name: "agent-mgr",
    permissions: ["agent:create", "agent:read", "agent:disable"],
  };
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

describe("SAML/SCIM provisioning", () => {
  it("provisions a SCIM user successfully", async () => {
    const { provisionSCIMUser } = await import("../src/index.js");
    const r = await provisionSCIMUser({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "a@b.com",
      emails: [{ value: "a@b.com", type: "work" }],
      active: true,
    });
    expect(r.success).toBe(true);
    expect(r.resourceId).toContain("user_");
  });

  it("verifies a SAML assertion (stub)", async () => {
    const { verifySAMLAssertion } = await import("../src/index.js");
    const r = verifySAMLAssertion("<saml/>");
    expect(r.email).toBeTruthy();
  });
});

describe("IdP integration — enterprise identity", () => {
  it("routeIdP matches by domain", async () => {
    const { routeIdP, EXAMPLE_ENTRA_CONFIG } = await import("../src/index.js");
    const result = routeIdP("alice@acmecorp.com", [EXAMPLE_ENTRA_CONFIG]);
    expect(result).toBeTruthy();
    expect(result!.provider).toBe("entra");
  });

  it("routeIdP falls back to default", async () => {
    const { routeIdP, EXAMPLE_ENTRA_CONFIG } = await import("../src/index.js");
    const result = routeIdP("bob@unknown.com", [EXAMPLE_ENTRA_CONFIG]);
    expect(result).toBeTruthy(); // falls back to default
  });

  it("mapIdPClaims maps Entra claims to ARM claims", async () => {
    const { mapIdPClaims, PRESET_CLAIM_MAPPINGS } = await import("../src/index.js");
    const raw = {
      sub: "user-1",
      email: "eng@acme.com",
      oid: "oid-1",
      department: "Engineering",
      jobTitle: "Senior Engineer",
    };
    const claims = mapIdPClaims(raw, PRESET_CLAIM_MAPPINGS.entra);
    expect(claims.email).toBe("eng@acme.com");
    expect(claims.scope).toBe("Engineering");
  });

  it("bootstrapAgent creates agent identity with credentials", async () => {
    const { bootstrapAgent } = await import("../src/index.js");
    const result = await bootstrapAgent({
      stakeholderUserId: "user_eng_1",
      agentName: "test-agent",
      agentType: "opencode",
      scopeType: "team",
      scopeId: "team_be",
      requestedTier: "critical",
    });
    expect(result.success).toBe(true);
    expect(result.agentId).toContain("agt_");
    expect(result.subAccountId).toContain("sa_");
    expect(result.apiKey).toContain("arm_sk_");
    // Critical tier downgraded without approval
    expect(result.message).toContain("standard");
  });
});
