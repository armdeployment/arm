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

/**
 * Org-tree mutation permission verbs (D6/D7 org-structure editing).
 *
 * These are capability-based, NOT title-based. A user's authority to restructure
 * the org tree flows entirely from their resolved roles at the relevant scope —
 * never from a hardcoded ladder. The scope-walk resolution algorithm in
 * docs/permission-rules.md §4 already handles "higher deny wins"; these verbs
 * ride on top of it without special-casing.
 *
 *   org_node:create   — add a child node (new plant, department, subsidiary)
 *   org_node:rename   — rename a node
 *   org_node:reparent  — move a node to a different parent (DANGEROUS — only org_admin)
 *   org_node:delete    — remove a node (only if no active agents under it)
 *
 * Default role presets that carry these are seeded by the Industry Profile
 * (packages/profiles) at provisioning time, but the org_admin can reconfigure
 * them at runtime via /admin/roles. The guardrail `no-profile-branching` ensures
 * runtime permission resolution reads roleTable rows (tenant config), never
 * the profile id.
 */
export const ORG_NODE_PERMISSIONS = [
  "org_node:create",
  "org_node:rename",
  "org_node:reparent",
  "org_node:delete",
] as const;

export type OrgNodePermission = (typeof ORG_NODE_PERMISSIONS)[number];

/** Convenience: the two "safe-to-delegate" verbs (create + rename). */
export const ORG_NODE_DELEGATABLE: readonly OrgNodePermission[] = [
  "org_node:create",
  "org_node:rename",
] as const;

/** Convenience: the two "org-admin-only" verbs (reparent + delete). */
export const ORG_NODE_ADMIN_ONLY: readonly OrgNodePermission[] = [
  "org_node:reparent",
  "org_node:delete",
] as const;

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

// ── Org-node mutation authority ────────────────────────────────────────────

/**
 * Scope ref for authority checks — the polymorphic (scopeType, scopeId) anchor
 * from roleTable. Null means "org root" (CEO/tenant-admin view).
 */
export interface MutationScope {
  type: "org" | "organization" | "hq" | "plant" | "department" | "group" | "line" | "cell" | "team";
  id: string;
}

/**
 * A resolved role scoping: the role's permission set PLUS the scope it was
 * granted at. Permission resolution walks scopes top-down (Invariant 3);
 * `scopeType`+`scopeId` tells us WHERE in the hierarchy this role lives.
 */
export interface ScopedRole extends ResolvedRole {
  scopeType: MutationScope["type"];
  scopeId: string;
}

/**
 * Checks whether the user may perform the given org-node verb at the given
 * target scope. Uses the same `hasPermission` primitive as everything else —
 * so the existing wildcard / scope-walk machinery applies unchanged.
 *
 * Authority rules (see docs/solutions/2026-08-02-d8-org-permissions.md):
 *   - create/rename: granted at OR ABOVE the target scope → allowed.
 *   - reparent/delete: only org_admin (scope = org root) may perform these.
 *
 * This helper does NOT itself walk the hierarchy — the caller resolves the
 * user's ScopedRole[] set first (from userRoleTable joined to roleTable), then
 * passes it here. The DB/policy layer does the scope-walk; this is a pure
 * predicate over the resolved set.
 */
export function canMutateOrgNode(
  roles: ScopedRole[],
  verb: OrgNodePermission,
  _targetScope: MutationScope,
): boolean {
  // reparent + delete are admin-only: the role must be granted at the org root.
  if (verb === "org_node:reparent" || verb === "org_node:delete") {
    return roles.some((r) => r.scopeType === "org" && hasPermission([r], verb));
  }
  // create + rename: any role at-or-above the target scope that carries the verb.
  return hasPermission(roles, verb);
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

// ── Enterprise IdP Integration (spec §6.3, §8.1) ──────────────────────────

/**
 * Supported enterprise identity providers.
 * Every real company uses one of these — ARM integrates with all of them.
 */
export type IdPProvider =
  | "entra" // Microsoft Entra ID (Azure AD)
  | "okta" // Okta Workforce Identity
  | "google" // Google Cloud Identity / Workspace
  | "aws" // AWS IAM Identity Center
  | "auth0" // Auth0 by Okta
  | "oidc" // Generic OpenID Connect
  | "saml"; // Generic SAML 2.0

/** Per-provider configuration. Stored in tenant IdP config (encrypted at rest). */
export interface IdPConfig {
  provider: IdPProvider;
  /** Human-readable label (e.g. "Acme Corp Okta"). */
  label: string;
  /** Issuer URL (OIDC .well-known/openid-configuration or SAML entity ID). */
  issuerUrl: string;
  /** Client ID (ARM is the Relying Party / Service Provider). */
  clientId: string;
  /** Client secret or certificate reference (vaulted). */
  clientSecretRef: string;
  /** JWKS URL for OIDC; certificate for SAML. */
  jwksUrl?: string;
  /** SAML-specific: IdP metadata XML URL. */
  samlMetadataUrl?: string;
  /** How to map IdP claims → ARM user attributes. */
  claimMapping: IdPClaimMapping;
  /** Domains this IdP serves (for email-based routing). */
  domains: string[];
  /** Whether to auto-provision new users discovered via this IdP. */
  autoProvision: boolean;
  /** Whether this is the default IdP for the tenant. */
  isDefault: boolean;
}

/** Maps external IdP claims to ARM internal attributes. */
export interface IdPClaimMapping {
  /** Which claim contains the user's email (primary identifier). */
  emailClaim: string; // e.g. "email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
  /** Which claim contains the display name. */
  displayNameClaim?: string; // e.g. "name", "displayName"
  /** Which claim contains the department (maps to ARM org tree). */
  departmentClaim?: string; // e.g. "department", "https://acme.com/claims/department"
  /** Which claim contains the group memberships (maps to ARM roles). */
  groupsClaim?: string; // e.g. "groups", "https://acme.com/claims/groups"
  /** Which claim contains the employee ID (for HR sync). */
  employeeIdClaim?: string; // e.g. "employee_id", "workerId"
  /** Which claim contains the job title (informational). */
  titleClaim?: string; // e.g. "jobTitle", "title"
}

/** Pre-built claim mappings for common providers. */
export const PRESET_CLAIM_MAPPINGS: Record<IdPProvider, IdPClaimMapping> = {
  entra: {
    emailClaim: "email",
    displayNameClaim: "name",
    departmentClaim: "department",
    groupsClaim: "groups",
    employeeIdClaim: "oid",
    titleClaim: "jobTitle",
  },
  okta: {
    emailClaim: "email",
    displayNameClaim: "name",
    departmentClaim: "department",
    groupsClaim: "groups",
    employeeIdClaim: "employee_id",
    titleClaim: "title",
  },
  google: {
    emailClaim: "email",
    displayNameClaim: "name",
    groupsClaim: "groups",
  },
  aws: {
    emailClaim: "email",
    displayNameClaim: "name",
    groupsClaim: "groups",
  },
  auth0: {
    emailClaim: "email",
    displayNameClaim: "name",
    departmentClaim: "https://acme.com/department",
    groupsClaim: "https://acme.com/groups",
  },
  oidc: {
    emailClaim: "email",
    displayNameClaim: "name",
    groupsClaim: "groups",
  },
  saml: {
    emailClaim: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    displayNameClaim: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    groupsClaim: "http://schemas.xmlsoap.org/claims/Group",
  },
};

/** Example Entra config (for manufacturing company "Acme Corp"). */
export const EXAMPLE_ENTRA_CONFIG: IdPConfig = {
  provider: "entra",
  label: "Acme Corp — Microsoft Entra ID",
  issuerUrl: "https://login.microsoftonline.com/acmecorp.onmicrosoft.com/v2.0",
  clientId: "arm-control-plane",
  clientSecretRef: "vault:tenant/acme/idp/entra/secret",
  jwksUrl: "https://login.microsoftonline.com/acmecorp.onmicrosoft.com/discovery/v2.0/keys",
  claimMapping: PRESET_CLAIM_MAPPINGS.entra,
  domains: ["acmecorp.com", "acme-manufacturing.com"],
  autoProvision: true,
  isDefault: true,
};

// ── Multi-IdP Token Verification ───────────────────────────────────────────

/**
 * Routes an authentication request to the correct IdP based on:
 *   1. The domain in the user's email (looks up IdP by domain)
 *   2. The `idp` hint parameter in the auth request
 *   3. The default IdP if no match
 */
export function routeIdP(email: string, idps: IdPConfig[]): IdPConfig | null {
  // Try domain-based routing
  const domain = email.split("@")[1];
  if (domain) {
    const matched = idps.find((idp) => idp.domains.includes(domain));
    if (matched) return matched;
  }
  // Fall back to default
  return idps.find((idp) => idp.isDefault) ?? idps[0] ?? null;
}

/**
 * Maps raw IdP claims to ARM internal claims using the provider's claim mapping.
 * This is how "department: Engineering" in Entra becomes a scope reference in ARM.
 */
export function mapIdPClaims(
  rawClaims: Record<string, unknown>,
  mapping: IdPClaimMapping,
): ARMClaims {
  const email = String(rawClaims[mapping.emailClaim!] ?? "");
  const tenant_id = "tn_demo"; // TODO: resolve from org context
  return {
    sub: String(rawClaims.sub ?? rawClaims.oid ?? email),
    tenant_id,
    email,
    scope: mapping.departmentClaim ? String(rawClaims[mapping.departmentClaim!] ?? "") : undefined,
  };
}

// ── Agent Identity Issuance Flow (spec §6.6, §8.1) ────────────────────────

/**
 * Agent identity bootstrapping flow:
 *
 *   1. Human engineer authenticates via corporate IdP (Entra/Okta/etc.)
 *      → ARM maps IdP claims → ARM user + scope (dept, team)
 *   2. Engineer runs `arm agent init` or clicks "Add Agent" in dashboard
 *   3. ARM creates:
 *      a. Agent record (owner_user_id = human, stakeholder_user_id = human)
 *      b. SubAccount record (agent_id = new agent, api_key_hash)
 *      c. DelegateKey (tenant_id, provider, key_ref)
 *   4. ARM returns credentials: sub_account_id + api_key
 *   5. Engineer configures their agent tool with the credentials
 *   6. Agent authenticates via ARM-issued credentials on subsequent calls
 *
 * For scope-owned agents (auto-spawned by automation):
 *   - owner_user_id = NULL, stakeholder_user_id = scope admin / template author
 *   - The spawning template must be approved by a scope admin
 */

export interface AgentOnboardingRequest {
  /** The human who owns/oversees this agent (authenticated via IdP). */
  stakeholderUserId: string;
  /** Agent display name. */
  agentName: string;
  /** Agent type (opencode / claude code / copilot / pi / custom). */
  agentType: string;
  /** Org scope for the agent. */
  scopeType: "org" | "department" | "group" | "team" | "workstream";
  scopeId: string;
  /** Requested priority tier (may be downgraded if not approved). */
  requestedTier: "critical" | "standard" | "background";
}

export interface AgentOnboardingResult {
  success: boolean;
  agentId?: string;
  subAccountId?: string;
  apiKey?: string;
  delegateKeyRef?: string;
  configuredBaseUrl?: string;
  message: string;
}

/**
 * Bootstraps a new agent identity. In production: creates the Agent + SubAccount
 * + DelegateKey rows, provisions credentials, and returns config for the agent.
 *
 * Stub: returns fixture credentials.
 */
export async function bootstrapAgent(req: AgentOnboardingRequest): Promise<AgentOnboardingResult> {
  // TODO(1.1): INSERT INTO agent (...) VALUES (...)
  // TODO(1.1): INSERT INTO sub_account (...) VALUES (...)
  // TODO(1.1): INSERT INTO delegate_key (...) VALUES (...)

  const agentId = `agt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const subAccountId = `sa_${agentId}`;
  const apiKey = `arm_sk_${agentId}_${Math.random().toString(36).slice(2, 16)}`;

  // Tier enforcement: critical requires scope-admin approval
  const effectiveTier = req.requestedTier === "critical" ? "standard" : req.requestedTier;

  return {
    success: true,
    agentId,
    subAccountId,
    apiKey,
    delegateKeyRef: `dk_arm_${subAccountId}`,
    configuredBaseUrl: "https://data.arm.acme.com/v1",
    message:
      effectiveTier !== req.requestedTier
        ? `Agent created at '${effectiveTier}' tier. 'critical' tier requires scope-admin approval (Invariant §11.8).`
        : `Agent '${req.agentName}' onboarded successfully.`,
  };
}
