/**
 * ARM Policy Resolver (spec §6 — Permission & Access Control).
 *
 * RBAC + ABAC hybrid with inheritance chain:
 *   Org → Dept → Group → Team → Workstream → Agent
 *
 * Core rule (Invariant §11.3): higher-level deny always wins, even against a
 * lower-level explicit allow. "Higher" = closer to the Org root (most authoritative).
 *
 * This package is PURE LOGIC — no DB imports (DAG: layer-2 packages don't
 * cross-import). Callers (trpc/app layer) fetch grants + policies from the DB
 * and pass them as plain data.
 */

import { SCOPE_RANK, type ScopeType } from "./scope-rank.js";

// ── Types ──────────────────────────────────────────────────────────────────

export { SCOPE_RANK };
export type { ScopeType };

export interface Grant {
  scopeType: ScopeType;
  scopeId: string;
  principalId: string;
  resourceId: string;
  actions: string[];
  deny: boolean;
  constraints?: Record<string, unknown>;
  expiresAt?: string; // ISO timestamp; expired grants are ignored
}

export interface AccessDecision {
  decision: "allow" | "deny";
  reason: string;
  matchedGrant?: Grant;
}

export interface ResolveAccessInput {
  grants: Grant[];
  principalId: string;
  resourceId: string;
  action: string;
  now?: Date;
}

// ── Resolver ───────────────────────────────────────────────────────────────

/**
 * Resolves whether a principal may perform an action on a resource.
 *
 * Algorithm (spec §6.1):
 * 1. Filter to grants matching principal + resource + action, not expired.
 * 2. Among matching grants, find the highest-authority (lowest rank) DENY.
 * 3. If a deny exists at authority level N, no allow at level > N can override.
 * 4. If no deny, any matching allow = allow.
 * 5. Default = deny (closed by default).
 */
export function resolveAccess(input: ResolveAccessInput): AccessDecision {
  const now = input.now ?? new Date();

  const matching = input.grants.filter((g) => {
    if (g.principalId !== input.principalId) return false;
    if (g.resourceId !== input.resourceId) return false;
    if (!g.actions.includes(input.action) && !g.actions.includes("*")) return false;
    if (g.expiresAt && new Date(g.expiresAt) < now) return false;
    return true;
  });

  if (matching.length === 0) {
    return { decision: "deny", reason: "no_matching_grant" };
  }

  // Find the highest-authority deny (lowest rank number).
  const denies = matching
    .filter((g) => g.deny)
    .sort((a, b) => SCOPE_RANK[a.scopeType] - SCOPE_RANK[b.scopeType]);

  if (denies.length > 0) {
    const topDeny = denies[0]!;
    return {
      decision: "deny",
      reason: `higher_level_deny_at_${topDeny.scopeType}`,
      matchedGrant: topDeny,
    };
  }

  // No denies — check for any allow.
  const allows = matching.filter((g) => !g.deny);
  if (allows.length > 0) {
    const topAllow = allows.sort((a, b) => SCOPE_RANK[a.scopeType] - SCOPE_RANK[b.scopeType])[0]!;
    return {
      decision: "allow",
      reason: `granted_at_${topAllow.scopeType}`,
      matchedGrant: topAllow,
    };
  }

  return { decision: "deny", reason: "no_allow_found" };
}

// ── LLM Policy Resolution (spec §6.5, §7) ──────────────────────────────────

export interface LLMPolicyRule {
  scopeType: ScopeType;
  scopeId: string;
  allowedModels: string[];
  autoDowngradeTo?: string;
}

export interface LLMDecision {
  allowed: boolean;
  model?: string | undefined;
  reason: string;
}

/**
 * Resolves which model an agent may use. The most specific (lowest authority)
 * applicable policy wins — if an agent's workstream policy restricts models,
 * that overrides broader policies.
 */
export function resolveLLMModel(
  policies: LLMPolicyRule[],
  requestedModel: string,
  agentScope: ScopeType,
  agentScopeId: string,
): LLMDecision {
  // Find policies applicable to this agent (same scope or broader).
  const applicable = policies
    .filter((p) => SCOPE_RANK[p.scopeType] <= SCOPE_RANK[agentScope])
    .sort((a, b) => SCOPE_RANK[b.scopeType] - SCOPE_RANK[a.scopeType]); // most specific first

  for (const policy of applicable) {
    const matches = policy.allowedModels.some(
      (m) => m === requestedModel || m === "*" || requestedModel.startsWith(m.replace("/*", "/")),
    );
    if (!matches) {
      return {
        allowed: false,
        reason: `model_${requestedModel}_not_in_policy_at_${policy.scopeType}`,
        model: policy.autoDowngradeTo,
      };
    }
    return { allowed: true, model: requestedModel, reason: `allowed_at_${policy.scopeType}` };
  }

  return { allowed: false, reason: "no_applicable_policy" };
}

// ── DLP Content Hooks (spec §9 Phase 2) ────────────────────────────────────

/**
 * DLP (Data Loss Prevention) content scanning hook points.
 * These interfaces are reserved for Phase 2 content-pattern DLP at the proxy.
 * Phase 1 ships metadata-only audit by default — these hooks are entry points
 * for future content-level scanning.
 */

export interface DLPContentHook {
  /** Unique hook identifier. */
  name: string;
  /** Classification level at which this hook triggers. */
  triggeredAt: "confidential" | "restricted" | "always";
  /** Whether the hook should block the request if triggered. */
  blockOnMatch: boolean;
  /** Scan content for sensitive patterns (PII, secrets, proprietary data). */
  scan(content: string): DLPContentResult;
}

export interface DLPContentResult {
  matched: boolean;
  patternName?: string;
  severity?: "info" | "warning" | "critical";
  detail?: string;
}

/** Registry of DLP content hooks — pluggable, configurable per tenant. */
export const DLP_HOOKS: DLPContentHook[] = [];

/**
 * Register a content-scanning hook. All registered hooks run on every request
 * through the proxy when content scanning is enabled.
 */
export function registerDLPHook(hook: DLPContentHook): void {
  DLP_HOOKS.push(hook);
}

/** Predefined PII detection hook (stub — real regex/ML patterns land in Phase 2). */
registerDLPHook({
  name: "pii_detection",
  triggeredAt: "confidential",
  blockOnMatch: true,
  scan(content: string): DLPContentResult {
    // Stub: check for obvious PII patterns
    const ssnMatch = content.match(/\d{3}-\d{2}-\d{4}/);
    if (ssnMatch)
      return {
        matched: true,
        patternName: "SSN",
        severity: "critical",
        detail: "Social Security Number detected",
      };
    return { matched: false };
  },
});

/** Predefined API key leakage detection hook. */
registerDLPHook({
  name: "api_key_leakage",
  triggeredAt: "always",
  blockOnMatch: true,
  scan(content: string): DLPContentResult {
    if (content.includes("sk-ant-") || content.includes("sk-proj-"))
      return {
        matched: true,
        patternName: "API_KEY",
        severity: "critical",
        detail: "Provider API key detected in content",
      };
    return { matched: false };
  },
});

// ── D9 Tool Authorization (per-tool grants + package model routing) ────────

export * from "./tool-access.js";
