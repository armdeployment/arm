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

// ── D9 Work Packages (spec §4.1 delta, docs/solutions/2026-08-13-d9-work-packages.md) ──

export const toolKindSchema = z.enum(["mcp", "http_api", "cli", "connector"]);
export type ToolKind = z.infer<typeof toolKindSchema>;

export const toolReviewStatusSchema = z.enum(["draft", "in_review", "approved", "rejected", "deprecated"]);
export type ToolReviewStatus = z.infer<typeof toolReviewStatusSchema>;

export const toolSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  kind: toolKindSchema,
  endpoint: z.string().min(1),
  auth_strategy: z.enum(["oauth", "pat", "service_account", "none"]),
  /** Data classification the tool may touch — feeds the D2 classification gate. */
  data_classification: z.enum(["public", "internal", "confidential", "restricted"]),
  owner_user_id: z.string().uuid(),
  review_status: toolReviewStatusSchema,
});

export const toolVersionSchema = z.object({
  id: z.string().uuid(),
  tool_id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Content hash of the manifest — packages pin exact versions. */
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  config_schema: z.record(z.string(), z.unknown()).default({}),
  changelog: z.string().default(""),
});

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
});

export const workPackageToolRefSchema = z.object({
  tool_id: z.string().uuid(),
  tool_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  scopes: z.array(z.string()).default([]),
});

export const workPackageVersionSchema = z.object({
  id: z.string().uuid(),
  package_id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tools: z.array(workPackageToolRefSchema).default([]),
  skills: z.array(z.string()).default([]),
  subagent_configs: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  model_routing: z.record(z.string(), z.unknown()).default({}),
  budget_template: z.record(z.string(), z.unknown()).default({}),
  starter_prompts: z.array(z.string()).default([]),
  template_refs: z.array(z.string()).default([]),
  min_agent_version: z.string().default("0.0.0"),
  /** sha256 over the canonical manifest JSON — config-tamper detection. */
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

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

export const catalogSchemas = {
  tool: toolSchema,
  tool_version: toolVersionSchema,
  work_package: workPackageSchema,
  work_package_version: workPackageVersionSchema,
  package_assignment: packageAssignmentSchema,
} as const;

// ── Aggregates / exports for convenience ───────────────────────────────────

export const eventSchemas = {
  token_usage_event: tokenUsageEventSchema,
  access_audit_event: accessAuditEventSchema,
} as const;

/** All field names across both event schemas — used by no-content-egress guardrail
 *  to verify no content-bearing fields sneak in (Invariant §11.1). */
export const ALL_EVENT_FIELDS: readonly string[] = [
  ...Object.keys(tokenUsageEventSchema.shape),
  ...Object.keys(accessAuditEventSchema.shape),
];
