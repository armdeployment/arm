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
