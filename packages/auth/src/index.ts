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
