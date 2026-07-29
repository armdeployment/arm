/**
 * ARM Auth package (spec §6.3, §6.6, §9 1.0).
 *
 * Hybrid identity model (Invariant §11.5):
 *   - OIDC SSO consumer: verifies tokens from external IdPs (Okta/Entra).
 *   - ARM-as-OIDC-issuer: mints tokens for agent resource federation (S3 STS, etc.).
 *   - RBAC: permission checking against resolved roles.
 *
 * DAG constraint (AGENTS.md): layer-2 package — may import proto/config only,
 * NOT db. Callers pass role/permission data from the DB layer.
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { z } from "zod";

// ── OIDC SSO Consumer ──────────────────────────────────────────────────────

/** Claims ARM extracts from any OIDC token (external IdP or ARM-issued). */
export const armClaimsSchema = z.object({
  sub: z.string(),
  tenant_id: z.string(),
  email: z.string().optional(),
  scope: z.string().optional(),
  // For agent-issued tokens:
  agent_id: z.string().optional(),
  sub_account_id: z.string().optional(),
  priority_tier: z.enum(["critical", "standard", "background"]).optional(),
});
export type ARMClaims = z.infer<typeof armClaimsSchema>;

export interface OIDCVerifierConfig {
  issuerUrl: string;
  jwksUrl: string;
  audience: string;
}

/**
 * Verifies an OIDC token against a remote JWKS (external IdP trust).
 * Throws on invalid signature, expired token, or wrong audience.
 */
export async function verifyOIDCToken(
  token: string,
  config: OIDCVerifierConfig,
): Promise<ARMClaims> {
  const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.issuerUrl,
    audience: config.audience,
  });
  return armClaimsSchema.parse(payload);
}

// ── RBAC Permission Checking ───────────────────────────────────────────────

/** Permission strings: "resource:action" format, e.g. "agent:create", "budget:read". */
export type Permission = string;

export interface ResolvedRole {
  name: string;
  permissions: Permission[];
}

/**
 * Checks whether any of the user's resolved roles grants the required permission.
 * Wildcard permissions ("*" or "resource:*") are supported.
 */
export function hasPermission(roles: ResolvedRole[], required: Permission): boolean {
  return roles.some((role) =>
    role.permissions.some(
      (p) => p === required || p === "*" || p.startsWith(required.split(":")[0] + ":*"),
    ),
  );
}

/**
 * Checks multiple permissions at once. All must pass (AND semantics).
 * Use hasAnyPermission for OR semantics.
 */
export function hasAllPermissions(roles: ResolvedRole[], required: Permission[]): boolean {
  return required.every((perm) => hasPermission(roles, perm));
}

/** Checks if any of the permissions is granted (OR semantics). */
export function hasAnyPermission(roles: ResolvedRole[], required: Permission[]): boolean {
  return required.some((perm) => hasPermission(roles, perm));
}

// ── ARM-as-OIDC-Issuer (skeleton) ──────────────────────────────────────────

/**
 * ARM issues OIDC tokens for agents so they can federate to cloud resources
 * (S3 STS AssumeRoleWithWebIdentity, GCS Workload Identity).
 *
 * The full issuer (signing keys, JWKS endpoint, token minting) lands in 1.0/1.3.
 * This skeleton defines the token shape and the mint interface.
 */

export interface AgentTokenInput {
  agentId: string;
  subAccountId: string;
  tenantId: string;
  priorityTier: "critical" | "standard" | "background";
  scope: string; // e.g. "s3:read bucket:my-team-data"
  ttlSeconds: number;
}

/** Builds the JWT payload for an ARM-issued agent token. The signing happens
 *  at the API layer (which has access to the signing key). */
export function buildAgentTokenPayload(input: AgentTokenInput): JWTPayload & ARMClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: input.agentId,
    tenant_id: input.tenantId,
    agent_id: input.agentId,
    sub_account_id: input.subAccountId,
    priority_tier: input.priorityTier,
    scope: input.scope,
    iat: now,
    exp: now + input.ttlSeconds,
    iss: "arm-issuer", // replaced with real issuer URL at signing time
    aud: "arm-resources",
  };
}

// ── SAML / SCIM Provisioning (spec §9 Phase 2) ────────────────────────────

/**
 * SCIM 2.0 user provisioning interface.
 * ARM acts as a SCIM service provider — enterprise IdPs (Okta, Entra, etc.)
 * push user/group updates to ARM via the standard SCIM protocol.
 *
 * Stub: returns the interface contract. Real implementation lands in Phase 2
 * when enterprise IdP integration testing begins.
 */

export interface SCIMUser {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"];
  id?: string;
  userName: string;
  name?: { familyName: string; givenName: string };
  emails: Array<{ value: string; type: "work" | "home" | "other"; primary?: boolean }>;
  active: boolean;
  groups?: Array<{ value: string; display: string }>;
}

export interface SCIMGroup {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"];
  id?: string;
  displayName: string;
  members?: Array<{ value: string; display: string }>;
}

export interface SCIMOperationResult {
  success: boolean;
  resourceId?: string;
  error?: string;
}

/**
 * Provision a user via SCIM. Maps SCIM user attributes to ARM User records.
 */
export async function provisionSCIMUser(user: SCIMUser): Promise<SCIMOperationResult> {
  // TODO(Phase 2): UPSERT INTO arm_user (email, org_id, tenant_id) ...
  return { success: true, resourceId: `user_${Date.now()}` };
}

/**
 * Provision a group via SCIM. Maps SCIM group to ARM Role/Scope.
 */
export async function provisionSCIMGroup(group: SCIMGroup): Promise<SCIMOperationResult> {
  // TODO(Phase 2): UPSERT INTO arm_role WHERE name = group.displayName
  return { success: true, resourceId: `group_${Date.now()}` };
}

/**
 * SAML 2.0 assertion verification.
 * ARM acts as a SAML service provider — validates SAML assertions from
 * enterprise IdPs (Okta, Entra, etc.) to authenticate users.
 */
export interface SAMLAssertion {
  issuer: string;
  subjectNameId: string;
  email: string;
  attributes: Record<string, string>;
  notOnOrAfter: string;
}

/**
 * Verify a SAML assertion. In production: validates XML signature against
 * IdP certificate, checks NotOnOrAfter, extracts user attributes.
 *
 * Stub: returns the parsed assertion (no signature verification).
 */
export function verifySAMLAssertion(assertionXml: string): SAMLAssertion {
  // TODO(Phase 2): Parse + verify SAML XML signature using IdP cert.
  return {
    issuer: "https://acme.okta.com/app/exk123/sso/saml",
    subjectNameId: "user@acme.com",
    email: "user@acme.com",
    attributes: { department: "Engineering", role: "engineer" },
    notOnOrAfter: new Date(Date.now() + 3600000).toISOString(),
  };
}
