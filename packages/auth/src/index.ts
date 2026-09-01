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
  /** IdP group memberships, carried through so `resolveRolesFromGroups` can
   *  turn them into ARM roles. Absent when the IdP emits no groups claim. */
  groups: z.array(z.string()).optional(),
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
  /**
   * Claim carrying the ARM tenant id. Defaults to `tenant_id`, which is what
   * an ARM-issued agent token has. An external IdP will not mint that claim
   * unless someone configures it, which is what `fixedTenantId` is for.
   */
  tenantClaim?: string;
  /**
   * Tenant to assign when the token carries no tenant claim — the normal case
   * for one ARM deployment serving one company. Without either this or a
   * tenant claim in the token, verification fails: a verified identity with no
   * tenant cannot be scoped, and Invariant 6 makes an unscoped identity
   * useless anyway.
   */
  fixedTenantId?: string;
  /** Claim carrying the user's email. Entra, Okta and Google all use `email`. */
  emailClaim?: string;
  /** Claim carrying group memberships. Defaults to `groups`, which Entra,
   *  Okta and Google all use; Auth0 rules typically namespace it. */
  groupsClaim?: string;
}

/**
 * Verifies an OIDC token against a remote JWKS (external IdP trust) and maps
 * its claims onto ARM's own claim shape.
 *
 * Throws on invalid signature, expired token, wrong issuer, wrong audience, or
 * a token that cannot be resolved to a tenant.
 *
 * On the tenant mapping: this used to `armClaimsSchema.parse(payload)` the raw
 * token, which requires a `tenant_id` claim. No real Okta, Entra or Google
 * token has one, so that path could only ever have verified ARM's own tokens —
 * every external IdP token would have failed schema parsing *after* passing
 * signature verification, which reads as "SSO is broken" rather than "SSO was
 * never mapped". The tenant now comes from a configurable claim, falling back
 * to a configured fixed tenant.
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
  return mapVerifiedPayload(payload, config);
}

/**
 * Maps an already-verified JWT payload onto ARM claims. Split out from
 * `verifyOIDCToken` so the mapping — the part with the interesting edge cases —
 * is testable without a live JWKS endpoint or a signing key.
 */
export function mapVerifiedPayload(
  payload: JWTPayload & Record<string, unknown>,
  config: Pick<OIDCVerifierConfig, "tenantClaim" | "fixedTenantId" | "emailClaim" | "groupsClaim">,
): ARMClaims {
  const tenantClaim = config.tenantClaim ?? "tenant_id";
  const emailClaim = config.emailClaim ?? "email";
  const groupsClaim = config.groupsClaim ?? "groups";

  const claimed = payload[tenantClaim];
  const tenantId =
    typeof claimed === "string" && claimed.length > 0 ? claimed : config.fixedTenantId;

  if (!tenantId) {
    throw new Error(
      `OIDC token verified but could not be resolved to a tenant: no "${tenantClaim}" claim ` +
        `and no fixed tenant configured. Set ARM_OIDC_TENANT_ID for a single-tenant deployment, ` +
        `or ARM_OIDC_TENANT_CLAIM to the claim your IdP puts the tenant in.`,
    );
  }

  const email = payload[emailClaim];
  const scope = payload.scope;
  // Same shape tolerance as `extractGroups`: array, comma-separated string,
  // or absent. Carried through so roles can be resolved from it downstream.
  const rawGroups = payload[groupsClaim];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String).filter((g) => g.length > 0)
    : typeof rawGroups === "string" && rawGroups.length > 0
      ? rawGroups
          .split(",")
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : undefined;

  return armClaimsSchema.parse({
    sub: payload.sub,
    tenant_id: tenantId,
    ...(typeof email === "string" ? { email } : {}),
    ...(typeof scope === "string" ? { scope } : {}),
    ...(groups && groups.length > 0 ? { groups } : {}),
    ...(typeof payload.agent_id === "string" ? { agent_id: payload.agent_id } : {}),
    ...(typeof payload.sub_account_id === "string"
      ? { sub_account_id: payload.sub_account_id }
      : {}),
    ...(typeof payload.priority_tier === "string" ? { priority_tier: payload.priority_tier } : {}),
  });
}

// ── Request authentication (what the tRPC routes actually call) ────────────

/**
 * How this process authenticates an incoming request, decided once from env.
 *
 *   oidc        — ARM_OIDC_ISSUER_URL + _JWKS_URL + _AUDIENCE are all set.
 *                 Bearer tokens are verified against the IdP's JWKS.
 *   development — none of them are set and this is not production. The caller's
 *                 built-in development identity is used, so a fresh clone runs
 *                 with zero configuration, matching ARM_FIXTURE_MODE=1.
 *   refuse      — none of them are set and this IS production. Every request is
 *                 unauthenticated, which makes protected procedures return
 *                 UNAUTHORIZED. Failing closed is the point: the alternative is
 *                 a production deployment silently authenticating every caller
 *                 as the same fixed user with the same fixed tenant.
 *   misconfigured — some but not all of the three are set. Also refuses; a
 *                 half-configured verifier is more dangerous than none.
 */
export type AuthMode =
  | { kind: "oidc"; config: OIDCVerifierConfig }
  | { kind: "development"; reason: string }
  | { kind: "refuse"; reason: string };

/** The env vars `resolveAuthMode` reads. Injected so it stays testable. */
export interface AuthEnv {
  ARM_OIDC_ISSUER_URL?: string | undefined;
  ARM_OIDC_JWKS_URL?: string | undefined;
  ARM_OIDC_AUDIENCE?: string | undefined;
  ARM_OIDC_TENANT_CLAIM?: string | undefined;
  ARM_OIDC_TENANT_ID?: string | undefined;
  ARM_OIDC_EMAIL_CLAIM?: string | undefined;
  ARM_OIDC_GROUPS_CLAIM?: string | undefined;
  ARM_ALLOW_DEV_IDENTITY?: boolean | undefined;
  NODE_ENV?: string | undefined;
}

export function resolveAuthMode(env: AuthEnv): AuthMode {
  const issuerUrl = env.ARM_OIDC_ISSUER_URL;
  const jwksUrl = env.ARM_OIDC_JWKS_URL;
  const audience = env.ARM_OIDC_AUDIENCE;
  const present = [issuerUrl, jwksUrl, audience].filter(Boolean).length;

  if (present === 3) {
    return {
      kind: "oidc",
      config: {
        issuerUrl: issuerUrl!,
        jwksUrl: jwksUrl!,
        audience: audience!,
        ...(env.ARM_OIDC_TENANT_CLAIM ? { tenantClaim: env.ARM_OIDC_TENANT_CLAIM } : {}),
        ...(env.ARM_OIDC_TENANT_ID ? { fixedTenantId: env.ARM_OIDC_TENANT_ID } : {}),
        ...(env.ARM_OIDC_EMAIL_CLAIM ? { emailClaim: env.ARM_OIDC_EMAIL_CLAIM } : {}),
        ...(env.ARM_OIDC_GROUPS_CLAIM ? { groupsClaim: env.ARM_OIDC_GROUPS_CLAIM } : {}),
      },
    };
  }

  if (present > 0) {
    const missing = [
      issuerUrl ? null : "ARM_OIDC_ISSUER_URL",
      jwksUrl ? null : "ARM_OIDC_JWKS_URL",
      audience ? null : "ARM_OIDC_AUDIENCE",
    ].filter(Boolean);
    return {
      kind: "refuse",
      reason: `OIDC is partially configured — missing ${missing.join(", ")}. Refusing rather than running with a half-built verifier.`,
    };
  }

  if (env.NODE_ENV === "production" && !env.ARM_ALLOW_DEV_IDENTITY) {
    return {
      kind: "refuse",
      reason:
        "NODE_ENV=production with no OIDC configuration. Set ARM_OIDC_ISSUER_URL, " +
        "ARM_OIDC_JWKS_URL and ARM_OIDC_AUDIENCE (see docs/sso-setup.md), or set " +
        "ARM_ALLOW_DEV_IDENTITY=1 if you intend everyone to share one fixed identity.",
    };
  }

  return {
    kind: "development",
    reason: env.ARM_ALLOW_DEV_IDENTITY
      ? "ARM_ALLOW_DEV_IDENTITY=1 — every caller shares one fixed identity."
      : "no OIDC configuration; using the built-in development identity.",
  };
}

/** Just enough of `Headers` to read one header, so tests need no DOM types. */
export interface HeaderReader {
  get(name: string): string | null;
}

/** Pulls the token out of `Authorization: Bearer <token>`, case-insensitively. */
export function bearerToken(headers: HeaderReader): string | null {
  const raw = headers.get("authorization") ?? headers.get("Authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1]!.trim() : null;
}

export interface AuthenticateOptions {
  /** Identity to use in `development` mode. Each app supplies its own. */
  developmentIdentity: ARMClaims;
  /** Overridable so tests don't need a live JWKS endpoint. */
  verify?: (token: string, config: OIDCVerifierConfig) => Promise<ARMClaims>;
  /** Overridable so tests can assert on what was reported. */
  onDiagnostic?: (message: string) => void;
}

/**
 * Resolves a request to ARM claims, or to `null` when it cannot be
 * authenticated. `null` is not an error path — `createContext` accepts it and
 * every protected procedure then returns UNAUTHORIZED, so an unauthenticated
 * request fails closed at the router rather than throwing out of the handler.
 */
export async function authenticateRequest(
  headers: HeaderReader,
  mode: AuthMode,
  options: AuthenticateOptions,
): Promise<ARMClaims | null> {
  const report = options.onDiagnostic ?? ((m: string) => console.error(`[auth] ${m}`));

  if (mode.kind === "refuse") {
    report(mode.reason);
    return null;
  }

  if (mode.kind === "development") {
    return options.developmentIdentity;
  }

  const token = bearerToken(headers);
  if (!token) return null;

  try {
    const verify = options.verify ?? verifyOIDCToken;
    return await verify(token, mode.config);
  } catch (err) {
    // Deliberately coarse: never report *why* a token failed to the caller.
    // The reason goes to the server log; the caller gets an unauthenticated
    // context and a plain UNAUTHORIZED from the router.
    report(`token rejected: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
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
 * Thrown by the identity surfaces that are declared but not built.
 *
 * These used to return plausible success values — `provisionSCIMUser`
 * answered `{ success: true, resourceId: "user_1756..." }` without writing
 * anything, and `verifySAMLAssertion` returned a fully-populated assertion
 * for any input at all, including `"<saml/>"` or an empty string.
 *
 * For a provisioning stub that is merely misleading: an IdP pushing users at
 * ARM would have been told every one was created. For an assertion verifier
 * it is worse — a function named `verify…` that returns a valid identity for
 * unvalidated input is an authentication bypass waiting for its first caller.
 * Nothing called them, which is the only reason this was not exploitable.
 *
 * Throwing is the correct stub for a security primitive: a caller wired up
 * early fails immediately and visibly, instead of silently authenticating
 * everyone as `user@acme.com`.
 */
export class NotImplementedError extends Error {
  constructor(surface: string, detail: string) {
    super(`${surface} is not implemented. ${detail}`);
    this.name = "NotImplementedError";
  }
}

/**
 * Provision a user via SCIM. Maps SCIM user attributes to ARM User records.
 *
 * NOT IMPLEMENTED — see {@link NotImplementedError}. Writing this needs the
 * DB layer, which this package may not import (it is layer-2: proto/config
 * only, per AGENTS.md), so the real implementation belongs behind a SCIM
 * route in the control plane that calls into `@arm/db`.
 */
export async function provisionSCIMUser(_user: SCIMUser): Promise<SCIMOperationResult> {
  throw new NotImplementedError(
    "SCIM user provisioning",
    "ARM does not yet accept an IdP's provisioning push. Create users through the " +
      "control plane, and see docs/sso-setup.md for what SSO does and does not cover.",
  );
}

/**
 * Provision a group via SCIM. Maps SCIM group to ARM Role/Scope.
 *
 * NOT IMPLEMENTED — see {@link NotImplementedError}.
 */
export async function provisionSCIMGroup(_group: SCIMGroup): Promise<SCIMOperationResult> {
  throw new NotImplementedError(
    "SCIM group provisioning",
    "Group-to-role mapping is available synchronously via `resolveRolesFromGroups`, " +
      "which maps an OIDC `groups` claim onto ARM roles without a provisioning push.",
  );
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
 * Verify a SAML assertion against the IdP's certificate.
 *
 * NOT IMPLEMENTED, and this one throws rather than returning a stub for a
 * specific reason: it used to answer any input — `"<saml/>"`, `""`, a
 * shopping list — with a complete, valid-looking assertion for
 * `user@acme.com` in the Engineering department. A `verify…` function whose
 * failure mode is "returns a valid identity" is an authentication bypass, and
 * the only thing standing between that and a real one was that nothing had
 * wired it up yet.
 *
 * Doing this properly means XML canonicalisation, signature verification
 * against the IdP certificate, NotOnOrAfter and Recipient checks, and replay
 * protection — none of which should be hand-rolled. Use OIDC instead; it is
 * implemented, tested and documented in docs/sso-setup.md, and every IdP ARM
 * targets speaks it.
 */
export function verifySAMLAssertion(_assertionXml: string): SAMLAssertion {
  throw new NotImplementedError(
    "SAML assertion verification",
    "Use OIDC (ARM_OIDC_ISSUER_URL / _JWKS_URL / _AUDIENCE) — see docs/sso-setup.md. " +
      "Entra, Okta, Google and Auth0 all support it, and it is verified against a live JWKS.",
  );
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
  /** Tenant these claims belong to. Previously hardcoded to "tn_demo", which
   *  silently placed every mapped identity in the demo tenant — the same
   *  tenant-resolution problem `verifyOIDCToken` solves with
   *  ARM_OIDC_TENANT_ID / ARM_OIDC_TENANT_CLAIM. It is a required argument
   *  now, because there is no safe default for "which company is this". */
  tenantId: string,
): ARMClaims {
  const email = String(rawClaims[mapping.emailClaim] ?? "");
  return {
    sub: String(rawClaims.sub ?? rawClaims.oid ?? email),
    tenant_id: tenantId,
    email,
    scope: mapping.departmentClaim ? String(rawClaims[mapping.departmentClaim] ?? "") : undefined,
  };
}

// ── IdP groups → ARM roles (D6/D7) ─────────────────────────────────────────

/**
 * One tenant-configured rule mapping an IdP group onto an ARM role.
 *
 * This is tenant configuration, read from `roleTable` by the caller — not
 * something this package resolves. `@arm/auth` is layer-2 and may not import
 * `@arm/db` (AGENTS.md), so the DB layer loads the rules and passes them in,
 * exactly as it already does for `ResolvedRole[]`.
 */
export interface GroupRoleRule {
  /** Group name or id as the IdP emits it, e.g. "arm-plant-7-admins". */
  group: string;
  /** ARM role to grant, with the permissions it carries. */
  role: ResolvedRole;
  /** Scope the role is granted at. Omitted = org root. */
  scopeType?: ScopedRole["scopeType"];
  scopeId?: string;
}

/**
 * Reads the IdP's groups claim off a verified token.
 *
 * Providers disagree about the shape: Entra and Okta emit an array of
 * strings, some Auth0 rules emit a single string, and a SAML-shaped claim can
 * arrive comma-separated. All three are accepted rather than only the one
 * that happens to be tested.
 */
export function extractGroups(
  rawClaims: Record<string, unknown>,
  mapping: IdPClaimMapping,
): string[] {
  if (!mapping.groupsClaim) return [];
  const raw = rawClaims[mapping.groupsClaim];
  if (Array.isArray(raw)) return raw.map(String).filter((g) => g.length > 0);
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }
  return [];
}

/**
 * Maps a user's IdP groups onto the ARM roles a tenant has bound to them.
 *
 * `PRESET_CLAIM_MAPPINGS` has recorded where each provider puts its groups
 * claim since the scaffold, and nothing read it — a verified user got a
 * subject, an email and a tenant, and their group memberships were dropped on
 * the floor. This is the piece that makes an IdP group mean something in ARM.
 *
 * Two properties worth stating, because both are load-bearing:
 *
 *   - Group matching is case-insensitive. Entra returns group *names* with
 *     whatever casing the directory has, and administrators do not reliably
 *     reproduce it when typing a rule.
 *   - An unmatched group grants nothing, silently. Membership of a group ARM
 *     has no rule for is not an error — most directories are full of groups
 *     that have nothing to do with ARM.
 *
 * Roles are deduplicated by name+scope, so a user in two groups bound to the
 * same role gets it once.
 */
export function resolveRolesFromGroups(groups: string[], rules: GroupRoleRule[]): ScopedRole[] {
  const byGroup = new Map<string, GroupRoleRule[]>();
  for (const rule of rules) {
    const key = rule.group.toLowerCase();
    byGroup.set(key, [...(byGroup.get(key) ?? []), rule]);
  }

  const resolved = new Map<string, ScopedRole>();
  for (const group of groups) {
    for (const rule of byGroup.get(group.toLowerCase()) ?? []) {
      const scopeType = rule.scopeType ?? "org";
      const scopeId = rule.scopeId ?? "org";
      const key = `${rule.role.name}@${scopeType}:${scopeId}`;
      if (!resolved.has(key)) {
        resolved.set(key, { ...rule.role, scopeType, scopeId });
      }
    }
  }
  return [...resolved.values()];
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
