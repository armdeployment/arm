/**
 * ARM event contracts (spec §4.2 + §14.1).
 *
 * Zod schemas for the two ClickHouse event tables. These are the single source
 * of truth for the wire format between data plane and control plane. Every
 * field here is METADATA ONLY — no prompt bodies, completions, or content
 * (Invariant §11.1, enforced by guardrails/no-content-egress).
 *
 * `packages/proto` has ZERO internal imports — zod contracts only (AGENTS.md).
 */

import { z } from "zod";

// ── token_usage_event (spec §4.2) ──────────────────────────────────────────

export const tokenUsageSourceSchema = z.enum(["proxy", "gateway", "plugin", "billing_api"]);
export type TokenUsageSource = z.infer<typeof tokenUsageSourceSchema>;

/**
 * Work-type classifier stage (D7). Tracks which cascade stage resolved the
 * work-type tag. `unknown` is first-class: stored as-is, never guessed.
 */
export const workTypeStageSchema = z.enum([
  "structural",
  "cache",
  "linear",
  "embedding",
  "unknown",
]);
export type WorkTypeStage = z.infer<typeof workTypeStageSchema>;

export const tokenUsageEventSchema = z.object({
  ts: z.string().datetime({ local: true }),
  tenant_id: z.string().min(1),
  sub_account_id: z.string().min(1),
  agent_id: z.string().min(1),
  priority_tier: z.enum(["critical", "standard", "background"]),
  model_id: z.string().min(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  source: tokenUsageSourceSchema,
  // ── D7 work-type tag (per-prompt, enforcement-ready) ──
  /** Primary work-type label from the agent's department taxonomy. NULL until
   *  resolved / `unknown` is stored as-is, never guessed. */
  work_type: z.string().nullable().default(null),
  /** Secondary structural tags (≤5): tool names, model ids, etc. */
  usage_tags: z.array(z.string()).max(5).default([]),
  /** Monotonic taxonomy version enabling re-labeling after taxonomy edits. */
  classifier_version: z.string().default("1"),
  /** Which cascade stage resolved the label (audit + gate forensics). */
  classifier_stage: workTypeStageSchema.default("unknown"),
  /** Confidence 0–1 (stage-dependent). NULL for `unknown`. */
  work_type_confidence: z.number().min(0).max(1).nullable().default(null),
  // ── D9 work-package attribution (additive; NULL for un-packaged traffic) ──
  /** Work Package id the call is attributed to (NULL = bare agent). */
  package_id: z.string().nullable().default(null),
  /** Pinned package version id — audit + upgrade forensics. */
  package_version_id: z.string().nullable().default(null),
  /** Agentic steps consumed by the enclosing task (loop-cap telemetry). */
  steps: z.number().int().nonnegative().default(0),
  /** Tool calls emitted by the agent (tool-gate + minimization telemetry). */
  tool_calls: z.number().int().nonnegative().default(0),
  /** Prompt-cache read tokens (cache-hit accounting, D9 §moat). */
  cache_read_tokens: z.number().int().nonnegative().default(0),
  /** Semantic-cache hit (1/0) — version-keyed per doc corpus. */
  semantic_cache_hit: z.number().int().min(0).max(1).default(0),
});

export type TokenUsageEvent = z.infer<typeof tokenUsageEventSchema>;

/**
 * What the data plane POSTs to the control plane's metering ingest endpoint.
 *
 * This is the one contract three separate processes have to agree on — the
 * proxy that emits, the meter-agent that buffers and forwards, and the
 * control-plane route that writes to ClickHouse. It lives here because
 * `@arm/proto` is the only package all three are allowed to import: the
 * data-plane trust boundary (AGENTS.md, `boundaries` guardrail) restricts
 * those apps to proto/config/client-core.
 *
 * It has drifted before. The meter-agent carried its own camelCase copy
 * (`subAccountId`, `model`, `costUsd`) while the ClickHouse table and this
 * schema use snake_case (`sub_account_id`, `model_id`, `cost_usd`), so the
 * two could never have exchanged an event even once they were connected.
 */
export const meteringBatchSchema = z.object({
  /** Identifies the sending data plane in control-plane logs. */
  source_id: z.string().min(1).max(200),
  events: z.array(tokenUsageEventSchema).min(1).max(1000),
});

export type MeteringBatch = z.infer<typeof meteringBatchSchema>;

export const meteringIngestResultSchema = z.object({
  accepted: z.number().int().nonnegative(),
  /** Events rejected for failing validation, with the index that failed. */
  rejected: z.array(z.object({ index: z.number().int(), reason: z.string() })).default([]),
  /** Whether the batch reached durable storage or was accepted in fixture mode. */
  persisted: z.boolean(),
});

export type MeteringIngestResult = z.infer<typeof meteringIngestResultSchema>;

// ── access_audit_event (spec §4.2) ──────────────────────────────────────────

export const accessDecisionSchema = z.enum(["allow", "deny", "jit_grant"]);
export type AccessDecision = z.infer<typeof accessDecisionSchema>;

export const accessAuditEventSchema = z.object({
  ts: z.string().datetime({ local: true }),
  tenant_id: z.string().min(1),
  agent_id: z.string().min(1),
  resource_id: z.string().min(1),
  action: z.string().min(1),
  decision: accessDecisionSchema,
  reason: z.string(),
  connector: z.string().min(1),
});

export type AccessAuditEvent = z.infer<typeof accessAuditEventSchema>;

// ── D10 Component Registry — `tool` generalizes to `component` (A3) ────────
//
// docs/guides/00-shared-contracts.md §1/§5. `tool`/`tool_version` and their
// proto schemas are DELETED — no production data exists, so this is a clean
// cutover with no compatibility shim. Permission verbs do NOT rename:
// `tool:invoke` / `tool:configure` / `tool:publish` (D8/D9) stay as-is and
// apply only to *callable* components (kind ∈ {mcp, http_api, cli, connector});
// the rest (plugin, skill, subagent, template, prompt_pack) are installed,
// not invoked, and carry no verb (docs/CONCEPTS.md).

export const componentKindSchema = z.enum([
  "mcp",
  "http_api",
  "cli",
  "connector", // callable → tool:* verbs apply
  "plugin",
  "skill",
  "subagent",
  "template",
  "prompt_pack", // installable
]);
export type ComponentKind = z.infer<typeof componentKindSchema>;

export const componentReviewStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "rejected",
  "deprecated",
]);
export type ComponentReviewStatus = z.infer<typeof componentReviewStatusSchema>;

export const componentSourceKindSchema = z.enum(["first_party", "tenant_authored", "imported"]);
export type ComponentSourceKind = z.infer<typeof componentSourceKindSchema>;

export const componentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  slug: z.string().min(1),
  kind: componentKindSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  owner_user_id: z.string().uuid(),
  review_status: componentReviewStatusSchema,
  source_kind: componentSourceKindSchema,
  source_ref: z.string().default(""),
  /** NULL for non-callable (installable) components. */
  endpoint: z.string().nullable().default(null),
  /** NULL for non-callable components. */
  auth_strategy: z.enum(["oauth", "pat", "service_account", "none"]).nullable().default(null),
  /** Data classification the component may touch — feeds the D2 classification gate. */
  data_classification: z.enum(["public", "internal", "confidential", "restricted"]),
  homepage_url: z.string().nullable().default(null),
});
export type Component = z.infer<typeof componentSchema>;

/** Versioned component reference — manifest v2 field #2 (guide 00 §4), and
 *  the shape of `work_package_version.components` entries. */
export const componentRefSchema = z.object({
  component_id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  kind: componentKindSchema,
  scopes: z.array(z.string()).default([]),
});
export type ComponentRef = z.infer<typeof componentRefSchema>;

export const componentVersionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  component_id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  manifest: z.record(z.string(), z.unknown()).default({}),
  /** Content hash of the manifest — packages pin exact versions. */
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** "sha256:<hex>" — never a mutable URL (guardrails/artifact-integrity). NULL for no-blob components. */
  blob_digest: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .nullable()
    .default(null),
  blob_size_bytes: z.number().int().nonnegative().nullable().default(null),
  blob_media_type: z.string().nullable().default(null),
  config_schema: z.record(z.string(), z.unknown()).default({}),
  requires: z
    .array(z.object({ component_slug: z.string().min(1), range: z.string().min(1) }))
    .default([]),
  changelog: z.string().default(""),
  yanked: z.boolean().default(false),
  published_at: z.string().datetime({ local: true }).nullable().default(null),
  published_by: z.string().uuid().nullable().default(null),
});
export type ComponentVersion = z.infer<typeof componentVersionSchema>;

export const componentBlobSchema = z.object({
  /** "sha256:<hex>" — the primary key; content-addressed. */
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  /** NULL only for `residency = 'control_plane'` first-party artifacts (guide 00 §3.1). */
  tenant_id: z.string().uuid().nullable().default(null),
  media_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
  storage_backend: z.enum(["fs", "s3", "oci"]),
  residency: z.enum(["control_plane", "tenant"]),
  storage_key: z.string().min(1),
  uploaded_by: z.string().uuid().nullable().default(null),
});
export type ComponentBlob = z.infer<typeof componentBlobSchema>;

// ── D10 Job functions + discovery ───────────────────────────────────────────

export const jobFunctionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  function_family: z.string().min(1),
  industry_profile: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  headcount_weight: z.number().int().nonnegative().default(0),
});
export type JobFunction = z.infer<typeof jobFunctionSchema>;

export const discoverySourceKindSchema = z.enum([
  "mcp_registry",
  "git",
  "http_index",
  "marketplace",
]);
export type DiscoverySourceKind = z.infer<typeof discoverySourceKindSchema>;

export const discoverySourceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  kind: discoverySourceKindSchema,
  name: z.string().min(1),
  endpoint: z.string().min(1),
  auth_ref: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  last_synced_at: z.string().datetime({ local: true }).nullable().default(null),
});
export type DiscoverySource = z.infer<typeof discoverySourceSchema>;

export const discoveryCandidateStatusSchema = z.enum(["new", "triaged", "promoted", "rejected"]);
export type DiscoveryCandidateStatus = z.infer<typeof discoveryCandidateStatusSchema>;

export const discoveryCandidateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  source_id: z.string().uuid(),
  external_ref: z.string().min(1),
  proposed_kind: componentKindSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  raw_manifest: z.record(z.string(), z.unknown()).default({}),
  status: discoveryCandidateStatusSchema,
  promoted_component_id: z.string().uuid().nullable().default(null),
  first_seen_at: z.string().datetime({ local: true }),
  reviewed_by: z.string().uuid().nullable().default(null),
  reviewed_at: z.string().datetime({ local: true }).nullable().default(null),
});
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;

// ── D9/D10 Work Packages (spec §4.1 delta, docs/solutions/2026-08-13-d9-work-packages.md,
//    docs/guides/00-shared-contracts.md §3.3) ────────────────────────────────

export const workPackageModeSchema = z.enum(["automated", "copilot"]);
export type WorkPackageMode = z.infer<typeof workPackageModeSchema>;

export const workPackageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role_key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  family: z.string().min(1),
  mode: workPackageModeSchema,
  description: z.string().default(""),
  /** A6: false ⇒ questionnaire recommendations for this package auto-approve;
   *  true (default) ⇒ routes to an approver. */
  approval_required: z.boolean().default(true),
});
export type WorkPackage = z.infer<typeof workPackageSchema>;

export const workPackageVersionSchema = z.object({
  id: z.string().uuid(),
  package_id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Manifest wire-shape version — 2 = the D10 manifest (guide 00 §4). No v1 reader. */
  manifest_version: z.literal(2).default(2),
  components: z.array(componentRefSchema).default([]),
  permissions: z.array(z.string()).default([]),
  model_routing: z.record(z.string(), z.unknown()).default({}),
  budget_template: z.record(z.string(), z.unknown()).default({}),
  starter_prompts: z.array(z.string()).default([]),
  min_agent_version: z.string().default("0.0.0"),
  job_functions: z.array(z.string()).default([]),
  /** sha256 over the canonical manifest v2 JSON — config-tamper detection. */
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type WorkPackageVersion = z.infer<typeof workPackageVersionSchema>;

export const packageAssignmentStatusSchema = z.enum(["requested", "approved", "active", "revoked"]);
export type PackageAssignmentStatus = z.infer<typeof packageAssignmentStatusSchema>;

export const packageAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  package_version_id: z.string().uuid(),
  assignee_type: z.enum(["user", "agent", "org_node"]),
  assignee_id: z.string().uuid(),
  status: packageAssignmentStatusSchema,
  approver_user_id: z.string().uuid().nullable().default(null),
  approved_at: z.string().datetime({ local: true }).nullable().default(null),
});
export type PackageAssignment = z.infer<typeof packageAssignmentSchema>;

// ── Manifest v2 — the hashed field list (guide 00 §4) ───────────────────────
//
// A deliberate wire break from v1 (nine fields, tool-shaped). EXACTLY these
// eight fields, in this order, snake_case, arrays sorted deterministically
// (components by component_id; permissions and job_functions lexicographic;
// starter_prompts keeps insertion order) are what `manifest_sha256` covers.
// This is the TYPE + CONTRACT only — `packages/proto` stays zod-schemas-only
// (zero internal imports); the canonicalizer/hasher is implemented by
// `@arm/catalog` (DB side) and `@arm/client-core` (client side) against this
// shape, and tested for byte-identical output via the shared golden vector
// at `packages/proto/test/fixtures/manifest-v2-golden.json`.

export const packageManifestV2Schema = z.object({
  manifest_version: z.literal(2),
  components: z.array(componentRefSchema),
  permissions: z.array(z.string()),
  model_routing: z.record(z.string(), z.unknown()),
  budget_template: z.record(z.string(), z.unknown()),
  starter_prompts: z.array(z.string()),
  min_agent_version: z.string(),
  job_functions: z.array(z.string()),
});
export type PackageManifestV2 = z.infer<typeof packageManifestV2Schema>;

export const catalogSchemas = {
  component: componentSchema,
  component_version: componentVersionSchema,
  job_function: jobFunctionSchema,
  work_package: workPackageSchema,
  work_package_version: workPackageVersionSchema,
  package_assignment: packageAssignmentSchema,
} as const;

// ── D10 Onboarding — questionnaire, setup token (guide 00 §5.1/§5.2, A4/A5/A6) ──

export const questionNodeSchema = z.object({
  id: z.string(),
  /** NOTE: no "text" kind — A5 (structured answers only, no free text). */
  kind: z.enum(["single", "multi", "scale"]),
  prompt: z.string(),
  help: z.string().default(""),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      signals: z.object({
        job_functions: z.array(z.string()).default([]),
        components: z.array(z.string()).default([]),
        weight: z.number().default(1),
      }),
    }),
  ),
  next: z.array(z.object({ when: z.string().nullable(), goto: z.string().nullable() })),
});
export type QuestionNode = z.infer<typeof questionNodeSchema>;

export const questionnaireGraphSchema = z.object({
  version: z.number().int(),
  industry_profile: z.string(),
  entry: z.string(),
  nodes: z.array(questionNodeSchema),
});
export type QuestionnaireGraph = z.infer<typeof questionnaireGraphSchema>;

/**
 * Structured answers ONLY (A5) — the enforcement point for Invariant 1 on the
 * questionnaire path. No free-text field exists in this schema: every value
 * is a string (an option value, never prose), a string array, a number, or a
 * boolean. Free-text questionnaire input never reaches the control plane.
 */
export const questionnaireAnswerSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
);
export type QuestionnaireAnswer = z.infer<typeof questionnaireAnswerSchema>;

export const questionnaireStatusSchema = z.enum(["draft", "published", "archived"]);
export type QuestionnaireStatus = z.infer<typeof questionnaireStatusSchema>;

/**
 * Setup token claims (A4 — one signed generic client + a per-user signed
 * setup token, never a per-user compiled binary). Never carries a
 * credential, a secret, or free text — see the contract test in
 * test/setup-token-claims.test.ts asserting no field named
 * secret|token|password|key|answer|text.
 */
export const setupTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.literal("arm-client"),
  jti: z.string(),
  sub: z.string(), // user id
  tenant_id: z.string(),
  package_version_ids: z.array(z.string()),
  connections_digest: z.string(), // sha256 of the connections manifest
  control_plane_url: z.string().url(),
  data_plane_url: z.string().url(),
  proxy_url: z.string().url(),
  exp: z.number(),
  iat: z.number(),
});
export type SetupTokenClaims = z.infer<typeof setupTokenClaimsSchema>;

// ── D10 Adoption events (spec §4.2 delta, guide 00 §6, ClickHouse
//    packages/clickhouse/migrations/0003_adoption.sql) ──────────────────────

export const activationStepSchema = z.enum([
  "invited",
  "questionnaire_started",
  "questionnaire_completed",
  "token_issued",
  "downloaded",
  "installed",
  "runtime_ready",
  "connections_started",
  "connections_completed",
  "first_metered_call",
  "weekly_active",
]);
export type ActivationStep = z.infer<typeof activationStepSchema>;

export const activationOutcomeSchema = z.enum(["ok", "error", "abandoned"]);
export type ActivationOutcome = z.infer<typeof activationOutcomeSchema>;

export const activationEventSchema = z.object({
  ts: z.string().datetime({ local: true }),
  tenant_id: z.string().min(1),
  org_node_id: z.string().min(1),
  /** Pseudonymous id — NEVER an email (Invariant 1). */
  user_ref: z.string().min(1),
  job_function_key: z.string().default(""),
  step: activationStepSchema,
  outcome: activationOutcomeSchema,
  package_version_id: z.string().default(""),
  client_version: z.string().default(""),
  error_code: z.string().default(""),
  duration_ms: z.number().int().nonnegative().default(0),
});
export type ActivationEvent = z.infer<typeof activationEventSchema>;

export const componentPullEventSchema = z.object({
  ts: z.string().datetime({ local: true }),
  tenant_id: z.string().min(1),
  component_id: z.string().min(1),
  version: z.string().min(1),
  blob_digest: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  cache_hit: z.union([z.literal(0), z.literal(1)]),
  client_version: z.string().default(""),
});
export type ComponentPullEvent = z.infer<typeof componentPullEventSchema>;

// ── Aggregates / exports for convenience ───────────────────────────────────

export const eventSchemas = {
  token_usage_event: tokenUsageEventSchema,
  access_audit_event: accessAuditEventSchema,
  activation_event: activationEventSchema,
  component_pull_event: componentPullEventSchema,
} as const;

/** All field names across every event schema — used by no-content-egress guardrail
 *  to verify no content-bearing fields sneak in (Invariant §11.1). */
export const ALL_EVENT_FIELDS: readonly string[] = [
  ...Object.keys(tokenUsageEventSchema.shape),
  ...Object.keys(accessAuditEventSchema.shape),
  ...Object.keys(activationEventSchema.shape),
  ...Object.keys(componentPullEventSchema.shape),
];
