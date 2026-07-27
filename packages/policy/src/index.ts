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

// ── Types ──────────────────────────────────────────────────────────────────

export type ScopeType = "org" | "department" | "group" | "team" | "workstream";

/** Authority rank: lower = more authoritative (Org root = 0). */
export const SCOPE_RANK: Record<ScopeType, number> = {
  org: 0,
  department: 1,
  group: 2,
  team: 3,
  workstream: 4,
};

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
    const topAllow = allows.sort(
      (a, b) => SCOPE_RANK[a.scopeType] - SCOPE_RANK[b.scopeType],
    )[0]!;
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
