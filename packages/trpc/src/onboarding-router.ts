/**
 * Onboarding router (docs/guides/03-client-downloader.md §4) — replaces the
 * guide-00 placeholder. Questionnaire → job-function/package recommendation
 * (via `@arm/questionnaire`, pure/deterministic) → signed setup token (A4) →
 * single-use redemption returning an installable manifest.
 *
 * Procedure names are frozen by guide 00 §8: `getQuestionnaire`,
 * `submitResponse`, `recommend`, `issueSetupToken`, `redeemSetupToken`,
 * `resolveActivationCode`. `redeemSetupToken`/`resolveActivationCode` are
 * PUBLIC procedures (no `tenantProcedure` auth) — the whole point of a setup
 * token is that a brand-new machine, with no prior ARM session, presents it
 * as its own credential (A4). The other four assume the browser already has
 * a tenant session (SSO or invite-code gate, guide 03 §3) — matching the
 * Wave-0 placeholder's choice.
 *
 * ── No free text, ever (A5 / Invariant 1) ───────────────────────────────────
 * `submitResponse`'s input is `questionnaireAnswerSchema` — structured
 * values only. `@arm/questionnaire`'s `score`/`recommend` are pure functions
 * of that input (no fetch/Date.now/Math.random/crypto.randomUUID reachable
 * from them — questionnaire-determinism guardrail). This router is the ONLY
 * place non-determinism (jti/timestamps/rate-limit clocks) enters the flow.
 *
 * ── Setup tokens never carry a secret (Invariant 4) ─────────────────────────
 * `setup_token` stores `token_sha256`, never the raw token. The raw JWT is
 * returned exactly once, at `issueSetupToken`, and never persisted.
 *
 * ── A6 auto-approve ──────────────────────────────────────────────────────
 * On redemption, a `package_assignment` is created: `approved` immediately
 * when the package's `approval_required` is `false`, else `requested` (the
 * client is told `pending_approval: true` and installs anyway — approval
 * gates tool access, never the install itself).
 *
 * ── Known cross-agent-timing note ───────────────────────────────────────────
 * `@arm/catalog`'s `packageVersionFixtures` are still v1-shaped
 * (tools/skills/subagent_configs/template_refs) pending the `library`
 * Wave-1 agent's migration to manifest v2 (components/job_functions) — see
 * `packages/trpc/src/catalog-router.ts`'s own note on this. Rather than
 * serve a manifest whose `manifest_sha256` can never verify client-side
 * (the v1 hash doesn't cover the v2 field set), this router builds its own
 * v2 `WorkPackageVersion` view of each fixture (empty `components[]` — there
 * is no real Component Registry data yet either, so this is honest, not
 * fabricated — and `job_functions: [role_key]` as a documented stand-in for
 * the not-yet-populated job-function taxonomy) and computes a FRESH
 * `manifest_sha256` via `@arm/client-core`'s v2 canonicalizer — the exact
 * function the client re-verifies with. This keeps `arm setup --token`
 * genuinely working end to end today; `library`'s migration will populate
 * real components without changing this router's shape.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { SignJWT, jwtVerify, decodeJwt } from "jose";
import type { ARMContext } from "./index.js";
import {
  isDemoMode,
  registerDemoArray,
  registerDemoMap,
  snapshotAllDemoStores,
  restoreAllDemoStores,
} from "./demo-mode.js";
import {
  questionnaireAnswerSchema,
  setupTokenClaimsSchema,
  workPackageSchema,
  workPackageVersionSchema,
  packageAssignmentSchema,
  type QuestionnaireAnswer,
  type WorkPackage,
  type WorkPackageVersion,
  type PackageAssignment,
  type SetupTokenClaims,
} from "@arm/proto";
import { packageVersionFixtures } from "@arm/catalog";
import { componentFixtures, componentVersionFixtures } from "@arm/artifactory";
import {
  graphForIndustryProfile,
  score,
  recommend,
  type CatalogIndex,
  type CatalogPackageEntry,
  type RecommendedPackage,
} from "@arm/questionnaire";
import { buildCanonicalManifest, manifestSha256 } from "@arm/client-core";

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

/** ARM_DEMO guaranteed-read-only guard (see ./demo-mode.ts) — applied to
 *  BOTH tenantProcedure and publicProcedure, since redeemSetupToken /
 *  resolveActivationCode are mutations on publicProcedure (A4: the token
 *  itself is the credential, so they run without a tenant session). */
const tenantProcedure = t.procedure
  .use(async (opts) => {
    const { ctx } = opts;
    if (!ctx.claims || !ctx.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
      });
    }
    return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
  })
  .use(async (opts) => {
    if (!isDemoMode() || opts.type !== "mutation") return opts.next();
    const snapshot = snapshotAllDemoStores();
    try {
      return await opts.next();
    } finally {
      restoreAllDemoStores(snapshot);
    }
  });

/** Setup-token redemption has NO prior session — the token itself is the
 *  credential (A4). Public by design, not an oversight. */
const publicProcedure = t.procedure.use(async (opts) => {
  if (!isDemoMode() || opts.type !== "mutation") return opts.next();
  const snapshot = snapshotAllDemoStores();
  try {
    return await opts.next();
  } finally {
    restoreAllDemoStores(snapshot);
  }
});

// ── Dev-mode signing config (TODO(1.1): real KMS-backed signing key, real
//    tenant→industry-profile lookup, real short-lived catalog/agent tokens
//    from @arm/billing + @arm/auth — this scaffold has no live DB, matching
//    every other router here) ─────────────────────────────────────────────

const SETUP_TOKEN_SECRET =
  process.env["ARM_SETUP_TOKEN_SECRET"] ?? "dev-only-setup-token-secret-do-not-use-in-prod";
const setupTokenSigningKey = new TextEncoder().encode(SETUP_TOKEN_SECRET);

const FIXTURE_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
const FIXTURE_OWNER_ID = "60000000-0000-4000-8000-000000000001";
const FIXTURE_USER_ID = "70000000-0000-4000-8000-000000000001";

const DEFAULT_CONTROL_PLANE_URL = process.env["ARM_CONTROL_PLANE_URL"] ?? "http://localhost:3300";
const DEFAULT_DATA_PLANE_URL = process.env["ARM_DATA_PLANE_URL"] ?? "http://localhost:8788";
const DEFAULT_PROXY_URL = process.env["ARM_PROXY_URL"] ?? "http://localhost:8787";

const SETUP_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes (guide 03 §4)

/** Local-time ISO string (no offset) — matches `datetime({ local: true })`. */
function localNowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ── Work-package fixtures (mirrors catalog-router.ts's own local fixture —
//    not exported from @arm/catalog, so duplicated here; same ids/role_keys
//    so package_version_id cross-references resolve identically) ───────────

const PACKAGE_FIXTURES: WorkPackage[] = workPackageSchema.array().parse([
  {
    id: "30000000-0000-4000-8000-000000000001",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "quality_engineer",
    name: "Quality Engineer",
    family: "Quality",
    mode: "copilot",
    description:
      "8D/PPAP/SPC copilot — defect triage, control plans, and customer submissions from ticketing + MES feeds.",
    approval_required: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "plc_programmer",
    name: "PLC Programmer",
    family: "Engineering Controls",
    mode: "copilot",
    description:
      "Ladder/ST codegen with IO-table import, AOI library, and diff/merge tooling for TIA Portal + Studio 5000.",
    approval_required: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "maintenance_technician",
    name: "Maintenance Technician",
    family: "Maintenance",
    mode: "copilot",
    description:
      "Fault → fix → CMMS loop: fault-code lookup, spares catalog, SOP checklists — mobile-first.",
    approval_required: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "office_worker_general",
    name: "Office Worker (General)",
    family: "General Office",
    mode: "copilot",
    description:
      "The volume default: chat, docs, SharePoint, email triage, meeting notes → actions.",
    // A6: high-volume, low-risk default package — no approver in the loop.
    approval_required: false,
  },
  {
    id: "30000000-0000-4000-8000-000000000005",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "exec_assistant",
    name: "Executive Assistant",
    family: "Executive",
    mode: "copilot",
    description:
      "KPI briefings, exec digests, approvals-inbox summaries — aggregates-only guardrail enforced.",
    approval_required: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000006",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "material_planner",
    name: "Material Planner",
    family: "Supply Chain",
    mode: "automated",
    description:
      "MRP exception triage, ECN impact alerts, EOL calculators — unattended batch runs.",
    // A6: unattended batch role — auto-approved, reviewed after the fact via /adoption.
    approval_required: false,
  },
  {
    id: "30000000-0000-4000-8000-000000000007",
    tenant_id: FIXTURE_TENANT_ID,
    role_key: "senior_manager",
    name: "Senior Manager",
    family: "Leadership",
    mode: "copilot",
    description:
      "Team ARM-adoption visibility, budget/spend oversight, and one-tap approvals — the decision-maker persona, not a hands-on tool user.",
    // A6/GTM beachhead (2026-08-25): low-friction self-serve for the persona
    // most likely to be the buyer — no approver in the loop.
    approval_required: false,
  },
]);

/** v1-shaped fixtures re-parsed through the v2 schema — permissions/
 *  model_routing/budget_template/starter_prompts/min_agent_version survive
 *  (shared field names); components/job_functions parse to their v2 empty
 *  defaults (see module doc header) and are overwritten below. */
const PACKAGE_VERSION_FIXTURES: WorkPackageVersion[] = workPackageVersionSchema
  .array()
  .parse(packageVersionFixtures);

function packageForVersionId(
  versionId: string,
): { pkg: WorkPackage; v1: WorkPackageVersion } | null {
  const v1 = PACKAGE_VERSION_FIXTURES.find((v) => v.id === versionId);
  if (!v1) return null;
  const pkg = PACKAGE_FIXTURES.find((p) => p.id === v1.package_id);
  if (!pkg) return null;
  return { pkg, v1 };
}

/** Build the v2 view of one package version with a FRESH, verifiable
 *  manifest_sha256. `@arm/catalog`'s `packageVersionFixtures` is now
 *  manifest-v2-real (library migrated it — component-review/artifact-
 *  integrity guardrails are non-vacuous), so real `components`/
 *  `job_functions` are pulled from there when a matching version exists;
 *  this router's own locally-duplicated fixtures (PACKAGE_VERSION_FIXTURES
 *  above) predate that migration and are the fallback for versions with no
 *  `@arm/catalog` counterpart. */
function buildV2Version(pkg: WorkPackage, v1: WorkPackageVersion): WorkPackageVersion {
  const catalogVersion = packageVersionFixtures.find((v) => v.id === v1.id);
  const draft: WorkPackageVersion = {
    id: v1.id,
    package_id: v1.package_id,
    version: v1.version,
    manifest_version: 2,
    components: catalogVersion?.components ?? [],
    permissions: v1.permissions,
    model_routing: v1.model_routing,
    budget_template: v1.budget_template,
    starter_prompts: v1.starter_prompts,
    min_agent_version: v1.min_agent_version,
    job_functions: catalogVersion?.job_functions ?? [pkg.role_key],
    manifest_sha256: "0".repeat(64),
  };
  return { ...draft, manifest_sha256: manifestSha256(buildCanonicalManifest(draft)) };
}

/** Resolve a version's `ComponentRef[]` against `@arm/artifactory`'s
 *  Component Registry fixtures — the same shape `library-router.ts`'s
 *  `getComponent` builds, `@arm/client-core`'s `ResolvedComponent`. Refs
 *  with no matching component/version fixture are skipped (still honest
 *  under §14.2 — this never fabricates a component). */
function resolveComponents(
  version: WorkPackageVersion,
): Array<{ component: unknown; version: unknown }> {
  const resolved: Array<{ component: unknown; version: unknown }> = [];
  for (const ref of version.components) {
    const component = componentFixtures.find((c) => c.id === ref.component_id);
    if (!component) continue;
    const componentVersion = componentVersionFixtures.find(
      (v) => v.component_id === ref.component_id && v.version === ref.version,
    );
    if (!componentVersion) continue;
    resolved.push({ component, version: componentVersion });
  }
  return resolved;
}

/** The `CatalogIndex` `@arm/questionnaire`'s pure `recommend()` consumes —
 *  built fresh per call from the fixtures above (no eligibility engine yet,
 *  so every package is eligible; TODO(1.1): real per-user/org eligibility). */
function buildCatalogIndex(): CatalogIndex {
  const packages: CatalogPackageEntry[] = PACKAGE_VERSION_FIXTURES.map((v1) => {
    const pkg = PACKAGE_FIXTURES.find((p) => p.id === v1.package_id);
    if (!pkg) return null;
    return {
      packageId: pkg.id,
      packageVersionId: v1.id,
      slug: pkg.role_key,
      name: pkg.name,
      jobFunctions: [pkg.role_key], // see module doc header
      headcountFit: 0,
      publishedAt: "2026-01-01T00:00:00",
      eligible: true,
      approvalRequired: pkg.approval_required,
    };
  }).filter((p): p is CatalogPackageEntry => p !== null);
  return { packages };
}

// ── Questionnaire definitions (published, versioned — guide 00 §3.2) ───────

const QUESTIONNAIRE_VERSION = 1;

function questionnaireDefinitionFor(industryProfile: string) {
  return {
    version: QUESTIONNAIRE_VERSION,
    industryProfile,
    status: "published" as const,
    graph: graphForIndustryProfile(industryProfile),
  };
}

// ── In-memory stores (no live DB — matches every other router here) ────────

interface QuestionnaireResponseRow {
  id: string;
  tenantId: string;
  definitionVersion: number;
  userId: string | null;
  orgNodeId: string | null;
  answers: QuestionnaireAnswer;
  resolvedJobFunctionKey: string | null;
  recommendedPackageVersionIds: string[];
  createdAt: string;
}
const responseStore: QuestionnaireResponseRow[] = [];

interface StoredSetupToken {
  jti: string;
  tenantId: string;
  tokenSha256: string;
  userId: string;
  packageVersionIds: string[];
  connectionsDigest: string;
  activationCode: string;
  controlPlaneUrl: string;
  dataPlaneUrl: string;
  proxyUrl: string;
  expiresAt: number; // epoch ms
  redeemedAt: number | null;
  redeemedClientVersion: string | null;
}
const setupTokenStore = new Map<string, StoredSetupToken>(); // keyed by jti
const activationCodeIndex = new Map<string, string>(); // activation_code -> jti

const assignmentStore: PackageAssignment[] = [];

registerDemoArray(responseStore);
registerDemoArray(assignmentStore);
registerDemoMap(setupTokenStore);
registerDemoMap(activationCodeIndex);
// attemptLog (rate-limiting) is deliberately NOT registered — it's internal
// abuse-prevention state, not visitor-facing content, and should keep
// working across demo mutations rather than reset after every call.

// ── Rate limiting (redemption is single-use + rate-limited per tenant, guide
//    03 §4) — simple in-memory sliding window; a real deployment fronts this
//    with a shared limiter (Redis) but the policy shape is the same. ───────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const attemptLog = new Map<string, number[]>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const attempts = (attemptLog.get(key) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  attempts.push(now);
  attemptLog.set(key, attempts);
  return attempts.length <= RATE_LIMIT_MAX_ATTEMPTS;
}

function newActivationCode(): string {
  // Excludes ambiguous glyphs (0/O, 1/I) — this is relayed by a human.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  } while (activationCodeIndex.has(code));
  return code;
}

// ── Wire shapes ──────────────────────────────────────────────────────────
// `components` is `{ component: Component; version: ComponentVersion }[]`
// (matching @arm/client-core's `ResolvedComponent`) — resolved for real
// against @arm/artifactory's fixtures by `resolveComponents` below.

interface ManifestWire {
  package: WorkPackage;
  version: WorkPackageVersion;
  components: unknown[];
}

interface ConnectionsManifestEntryWire {
  componentId: string;
  componentName: string;
  authMethod: "oauth" | "pat" | "service_account" | "none";
  guideId: string;
  requiredScopes: string[];
}

export interface RedemptionResult {
  status: "ok" | "expired" | "already_used" | "invalid";
  message: string;
  manifest?: ManifestWire;
  connections?: ConnectionsManifestEntryWire[];
  sub_account_id?: string;
  tenant_id?: string;
  proxy_url?: string;
  data_plane_url?: string;
  catalog_token?: string;
  agent_token?: string;
  pending_approval?: boolean;
}

function redemptionFailure(
  status: "expired" | "already_used" | "invalid",
  message: string,
): RedemptionResult {
  return { status, message };
}

/** Shared post-lookup redemption logic — used by both `redeemSetupToken`
 *  (after JWT verification) and `resolveActivationCode` (after a direct
 *  store lookup by code; there is no raw token to verify there, since only
 *  its hash is ever stored — Invariant 4). */
function completeRedemption(
  stored: StoredSetupToken,
  clientVersion: string | undefined,
): RedemptionResult {
  if (stored.redeemedAt !== null) {
    return redemptionFailure(
      "already_used",
      "this setup link was already used — ask IT for a new one",
    );
  }
  if (Date.now() > stored.expiresAt) {
    return redemptionFailure(
      "expired",
      "this setup link has expired — ask your admin for a new one",
    );
  }

  const resolved = packageForVersionId(stored.packageVersionIds[0] ?? "");
  if (!resolved) {
    return redemptionFailure(
      "invalid",
      "this setup link points at an unknown package — ask IT for a new one",
    );
  }

  stored.redeemedAt = Date.now();
  stored.redeemedClientVersion = clientVersion ?? "";

  const version = buildV2Version(resolved.pkg, resolved.v1);
  const resolvedComponents = resolveComponents(version);
  const manifest: ManifestWire = { package: resolved.pkg, version, components: resolvedComponents };
  const connections: ConnectionsManifestEntryWire[] = resolvedComponents
    .map(({ component }) => component as { id: string; name: string; auth_strategy: string | null })
    .filter((c) => c.auth_strategy !== null && c.auth_strategy !== "none")
    .map((c) => ({
      componentId: c.id,
      componentName: c.name,
      authMethod: c.auth_strategy as "oauth" | "pat" | "service_account",
      guideId: c.name,
      requiredScopes: version.components.find((ref) => ref.component_id === c.id)?.scopes ?? [],
    }));

  // A6 — assignment coupling on redemption.
  const approved = !resolved.pkg.approval_required;
  const assignment = packageAssignmentSchema.parse({
    id: randomUUID(),
    tenant_id: stored.tenantId,
    package_version_id: version.id,
    assignee_type: "user",
    assignee_id: stored.userId,
    status: approved ? "approved" : "requested",
    approver_user_id: null,
    approved_at: approved ? localNowIso() : null,
  });
  assignmentStore.push(assignment);

  return {
    status: "ok",
    message: "",
    manifest,
    connections,
    sub_account_id: `sa_${stored.userId}`,
    tenant_id: stored.tenantId,
    proxy_url: stored.proxyUrl,
    data_plane_url: stored.dataPlaneUrl,
    // TODO(1.1): mint real short-lived tokens via @arm/billing + @arm/auth
    // (Invariant 4). Dev-mode placeholders — this scaffold has no live
    // catalog/proxy auth path yet, matching every other router here.
    catalog_token: `catalog_dev_${stored.jti}`,
    agent_token: `arm_mtr_dev_${stored.jti}`,
    pending_approval: !approved,
  };
}

// ── Router ───────────────────────────────────────────────────────────────

export const onboardingRouter = t.router({
  /** Published questionnaire graph for the tenant's industry profile. */
  getQuestionnaire: tenantProcedure
    .input(z.object({ industryProfile: z.string().optional() }).optional())
    .query(async (opts) => {
      const definition = questionnaireDefinitionFor(opts.input?.industryProfile ?? "manufacturing");
      return { tenantId: opts.ctx.tenantId!, questionnaire: definition };
    }),

  /** Zod-validate structured-only answers (A5), store the response, return recommendations. */
  submitResponse: tenantProcedure
    .input(
      z.object({
        industryProfile: z.string().default("manufacturing"),
        orgNodeId: z.string().optional(),
        userId: z.string().optional(),
        answers: questionnaireAnswerSchema,
      }),
    )
    .mutation(async (opts) => {
      const { industryProfile, orgNodeId, userId, answers } = opts.input;
      const graph = graphForIndustryProfile(industryProfile);
      const ranked = score(answers, graph);
      const resolvedJobFunctionKey = ranked[0]?.key ?? null;
      const recommendations: RecommendedPackage[] = recommend(ranked, buildCatalogIndex());

      const row: QuestionnaireResponseRow = {
        id: randomUUID(),
        tenantId: opts.ctx.tenantId!,
        definitionVersion: QUESTIONNAIRE_VERSION,
        userId: userId ?? null,
        orgNodeId: orgNodeId ?? null,
        answers,
        resolvedJobFunctionKey,
        recommendedPackageVersionIds: recommendations.map((r) => r.packageVersionId),
        createdAt: localNowIso(),
      };
      responseStore.push(row);

      return {
        tenantId: opts.ctx.tenantId!,
        responseId: row.id,
        resolvedJobFunctionKey,
        recommendations,
      };
    }),

  /** Pure re-run without storing (used by "something else"). */
  recommend: tenantProcedure
    .input(
      z.object({
        industryProfile: z.string().default("manufacturing"),
        answers: questionnaireAnswerSchema,
      }),
    )
    .query(async (opts) => {
      const graph = graphForIndustryProfile(opts.input.industryProfile);
      const ranked = score(opts.input.answers, graph);
      const recommendations = recommend(ranked, buildCatalogIndex());
      return { tenantId: opts.ctx.tenantId!, recommendations };
    }),

  /** Mint a signed JWT (A4) — stores only its sha256 + a unique 6-char activation code; TTL 15 min; single use. */
  issueSetupToken: tenantProcedure
    .input(
      z.object({
        packageVersionIds: z.array(z.string()).min(1),
        userId: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      const userId = opts.input.userId ?? FIXTURE_USER_ID;
      const jti = randomUUID();
      const now = Date.now();
      const connectionsDigest = manifestSha256([]); // no resolved connections yet — see module doc header

      const claims: SetupTokenClaims = setupTokenClaimsSchema.parse({
        iss: DEFAULT_CONTROL_PLANE_URL,
        aud: "arm-client",
        jti,
        sub: userId,
        tenant_id: tenantId,
        package_version_ids: opts.input.packageVersionIds,
        connections_digest: connectionsDigest,
        control_plane_url: DEFAULT_CONTROL_PLANE_URL,
        data_plane_url: DEFAULT_DATA_PLANE_URL,
        proxy_url: DEFAULT_PROXY_URL,
        exp: Math.floor((now + SETUP_TOKEN_TTL_MS) / 1000),
        iat: Math.floor(now / 1000),
      });

      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .sign(setupTokenSigningKey);

      const activationCode = newActivationCode();
      const stored: StoredSetupToken = {
        jti,
        tenantId,
        tokenSha256: sha256Hex(token),
        userId,
        packageVersionIds: opts.input.packageVersionIds,
        connectionsDigest,
        activationCode,
        controlPlaneUrl: DEFAULT_CONTROL_PLANE_URL,
        dataPlaneUrl: DEFAULT_DATA_PLANE_URL,
        proxyUrl: DEFAULT_PROXY_URL,
        expiresAt: now + SETUP_TOKEN_TTL_MS,
        redeemedAt: null,
        redeemedClientVersion: null,
      };
      setupTokenStore.set(jti, stored);
      activationCodeIndex.set(activationCode, jti);

      return {
        tenantId,
        token,
        activationCode,
        expiresAt: new Date(stored.expiresAt).toISOString(),
      };
    }),

  /**
   * Verify signature + expiry + unredeemed state; mark redeemed with the
   * client version; return the package manifest + connections manifest.
   * PUBLIC (no tenant session) — the token itself is the credential (A4).
   */
  redeemSetupToken: publicProcedure
    .input(z.object({ token: z.string().min(1), clientVersion: z.string().optional() }))
    .mutation(async (opts): Promise<RedemptionResult> => {
      const { token, clientVersion } = opts.input;

      // Best-effort, UNVERIFIED decode — used only to pick a rate-limit
      // bucket before we've established the token is genuine. The real
      // security check (signature + stored-hash match) happens below.
      let rateLimitKey = "malformed";
      try {
        const unsafeClaims = decodeJwt(token);
        rateLimitKey =
          typeof unsafeClaims["tenant_id"] === "string" ? unsafeClaims["tenant_id"] : "malformed";
      } catch {
        // fall through with the "malformed" bucket
      }
      if (!checkRateLimit(rateLimitKey)) {
        return redemptionFailure("invalid", "too many attempts — try again in a minute");
      }

      let claims: SetupTokenClaims;
      try {
        const { payload } = await jwtVerify(token, setupTokenSigningKey, {
          audience: "arm-client",
        });
        claims = setupTokenClaimsSchema.parse(payload);
      } catch {
        return redemptionFailure("invalid", "this setup link is invalid");
      }

      const stored = setupTokenStore.get(claims.jti);
      if (!stored || stored.tokenSha256 !== sha256Hex(token)) {
        return redemptionFailure("invalid", "this setup link is invalid");
      }

      return completeRedemption(stored, clientVersion);
    }),

  /** Resolve a 6-char activation code to its setup token, then redeem it via
   *  the same path (guide 03 §4). PUBLIC — same rationale as above. */
  resolveActivationCode: publicProcedure
    .input(z.object({ code: z.string().length(6), clientVersion: z.string().optional() }))
    .mutation(async (opts): Promise<RedemptionResult> => {
      const code = opts.input.code.toUpperCase();
      if (!checkRateLimit(`code:${code}`)) {
        return redemptionFailure("invalid", "too many attempts — try again in a minute");
      }

      const jti = activationCodeIndex.get(code);
      const stored = jti ? setupTokenStore.get(jti) : undefined;
      if (!stored) {
        return redemptionFailure("invalid", "this activation code is invalid");
      }

      return completeRedemption(stored, opts.input.clientVersion);
    }),
});

export type OnboardingRouter = typeof onboardingRouter;

/** The fixture tenant every onboarding-router package/assignment fixture is
 *  scoped to (guide 03 §3: `apps/onboarding`'s dev-mode tRPC context uses
 *  this so the questionnaire → recommendation → redemption flow resolves
 *  against real, consistent fixture data end to end). */
export const ONBOARDING_FIXTURE_TENANT_ID = FIXTURE_TENANT_ID;

// Exported for apps/onboarding's REST wrappers (which call these procedures
// directly via a tRPC server-side caller, not raw internals) and for tests.
export const __test = {
  PACKAGE_FIXTURES,
  PACKAGE_VERSION_FIXTURES,
  responseStore,
  setupTokenStore,
  activationCodeIndex,
  assignmentStore,
};
