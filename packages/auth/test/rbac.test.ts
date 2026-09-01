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

describe("SAML/SCIM — unbuilt surfaces must fail loudly", () => {
  // These previously returned plausible success. `provisionSCIMUser` answered
  // `{ success: true, resourceId: "user_1756..." }` having written nothing, so
  // an IdP's provisioning push would have been told every user was created.
  // `verifySAMLAssertion` was worse: it returned a complete, valid-looking
  // assertion for user@acme.com given ANY input, so the first caller to wire
  // it up would have had an authentication bypass. The old test here asserted
  // exactly that — `expect(r.email).toBeTruthy()` on `verifySAMLAssertion("<saml/>")`.
  it("SCIM user provisioning throws instead of reporting a phantom write", async () => {
    const { provisionSCIMUser, NotImplementedError } = await import("../src/index.js");
    await expect(
      provisionSCIMUser({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: "a@b.com",
        emails: [{ value: "a@b.com", type: "work" }],
        active: true,
      }),
    ).rejects.toBeInstanceOf(NotImplementedError);
  });

  it("SCIM group provisioning throws, and points at what does work", async () => {
    const { provisionSCIMGroup } = await import("../src/index.js");
    await expect(
      provisionSCIMGroup({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: "arm-admins",
      }),
    ).rejects.toThrow(/resolveRolesFromGroups/);
  });

  it("SAML verification NEVER returns an identity for unverified input", async () => {
    const { verifySAMLAssertion } = await import("../src/index.js");
    for (const input of ["<saml/>", "", "not xml at all", "<Assertion>forged</Assertion>"]) {
      expect(() => verifySAMLAssertion(input)).toThrow(/not implemented/i);
    }
  });

  it("SAML failure points at OIDC, which is implemented", async () => {
    const { verifySAMLAssertion } = await import("../src/index.js");
    expect(() => verifySAMLAssertion("<saml/>")).toThrow(/docs\/sso-setup\.md/);
  });
});

describe("IdP groups → ARM roles", () => {
  const adminRule = {
    group: "arm-admins",
    role: { name: "org_admin", permissions: ["*"] },
  };
  const plantRule = {
    group: "plant-7-leads",
    role: { name: "plant_lead", permissions: ["agent:create", "budget:read"] },
    scopeType: "plant" as const,
    scopeId: "plant_7",
  };

  it("grants the roles a tenant bound to the user's groups", async () => {
    const { resolveRolesFromGroups, hasPermission } = await import("../src/index.js");
    const roles = resolveRolesFromGroups(["plant-7-leads"], [adminRule, plantRule]);
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ name: "plant_lead", scopeType: "plant", scopeId: "plant_7" });
    expect(hasPermission(roles, "agent:create")).toBe(true);
    expect(hasPermission(roles, "org_node:delete")).toBe(false);
  });

  it("matches group names case-insensitively", async () => {
    // Entra returns whatever casing the directory has; an admin typing the
    // rule will not reliably reproduce it.
    const { resolveRolesFromGroups } = await import("../src/index.js");
    expect(resolveRolesFromGroups(["ARM-Admins"], [adminRule])).toHaveLength(1);
  });

  it("grants NOTHING for a group with no rule", async () => {
    // Most directories are full of groups that have nothing to do with ARM.
    const { resolveRolesFromGroups } = await import("../src/index.js");
    expect(resolveRolesFromGroups(["everyone", "birthday-club"], [adminRule])).toEqual([]);
  });

  it("deduplicates a role reachable through two groups", async () => {
    const { resolveRolesFromGroups } = await import("../src/index.js");
    const alias = { group: "arm-admins-legacy", role: adminRule.role };
    expect(
      resolveRolesFromGroups(["arm-admins", "arm-admins-legacy"], [adminRule, alias]),
    ).toHaveLength(1);
  });

  it("keeps the same role at two different scopes apart", async () => {
    const { resolveRolesFromGroups } = await import("../src/index.js");
    const plant8 = { ...plantRule, group: "plant-8-leads", scopeId: "plant_8" };
    const roles = resolveRolesFromGroups(["plant-7-leads", "plant-8-leads"], [plantRule, plant8]);
    expect(roles.map((r) => r.scopeId).sort()).toEqual(["plant_7", "plant_8"]);
  });

  it("reads the groups claim in every shape providers actually emit", async () => {
    const { extractGroups, PRESET_CLAIM_MAPPINGS } = await import("../src/index.js");
    const m = PRESET_CLAIM_MAPPINGS.entra;
    expect(extractGroups({ groups: ["a", "b"] }, m)).toEqual(["a", "b"]);
    expect(extractGroups({ groups: "a, b" }, m)).toEqual(["a", "b"]); // comma-separated
    expect(extractGroups({ groups: "solo" }, m)).toEqual(["solo"]);
    expect(extractGroups({}, m)).toEqual([]);
  });

  it("carries groups through token verification", async () => {
    const { mapVerifiedPayload } = await import("../src/index.js");
    const claims = mapVerifiedPayload(
      { sub: "u1", groups: ["arm-admins"] },
      { fixedTenantId: "tn_acme" },
    );
    expect(claims.groups).toEqual(["arm-admins"]);
  });

  it("reads a namespaced groups claim when configured (the Auth0 shape)", async () => {
    const { mapVerifiedPayload } = await import("../src/index.js");
    const claims = mapVerifiedPayload(
      { sub: "u1", "https://acme.com/groups": ["eng"] },
      { fixedTenantId: "tn_acme", groupsClaim: "https://acme.com/groups" },
    );
    expect(claims.groups).toEqual(["eng"]);
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
    // The tenant is a required argument now. It used to be hardcoded to
    // "tn_demo", which silently placed every mapped identity in the demo
    // tenant — there is no safe default for "which company is this".
    const claims = mapIdPClaims(raw, PRESET_CLAIM_MAPPINGS.entra, "tn_acme");
    expect(claims.email).toBe("eng@acme.com");
    expect(claims.scope).toBe("Engineering");
    expect(claims.tenant_id).toBe("tn_acme");
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
