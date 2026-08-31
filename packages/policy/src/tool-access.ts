/**
 * D9 Work Packages — per-tool authorization + package model routing.
 *
 * Decision record: docs/solutions/2026-08-13-d9-work-packages.md
 * Sub-decisions locked: tool verbs `tool:invoke` / `tool:configure` /
 * `tool:publish` (D8 extension); deny-override + inheritance unchanged
 * (Invariant §11.3); tiered approval defaults for copilot-mode tool requests.
 *
 * This module is PURE LOGIC — no DB imports. Callers (trpc/app layer) fetch
 * tool grants from the control plane and pass them as plain data. The
 * `ToolGrant` interface mirrors `ToolGrantInput` in
 * packages/db/src/schema/catalog.ts; it is defined locally because
 * `@arm/db` is deliberately not a dependency of `@arm/policy`.
 */

import { TOOL_SCOPE_RANK, type ScopeType } from "./scope-rank.js";

// ── Tool action verbs (D9 sub-decision 3) ──────────────────────────────────

export type ToolAction = "invoke" | "configure" | "publish";

/** `tool:*` verb strings — D8 permission-verb extension for D9 tool authz. */
export const TOOL_ACTION_VERBS = ["tool:invoke", "tool:configure", "tool:publish"] as const;

/** Maps a ToolAction to its `tool:*` permission verb. */
export function toolVerbFor(action: ToolAction): (typeof TOOL_ACTION_VERBS)[number] {
  switch (action) {
    case "invoke":
      return "tool:invoke";
    case "configure":
      return "tool:configure";
    case "publish":
      return "tool:publish";
  }
}

// ── Tool scope authority ────────────────────────────────────────────────────

/**
 * Tool grants share the same authority rank map as resource grants
 * (packages/policy/src/scope-rank.ts) — single source of truth, so the same
 * grant resolves identically in `resolveAccess` and `resolveToolAccess`.
 * Re-exported here for backwards-compatible imports.
 */
export { TOOL_SCOPE_RANK };

/** Rank lookup; unknown scope types rank last (least authoritative), never NaN. */
function toolScopeRank(scopeType: string): number {
  return (
    (TOOL_SCOPE_RANK as Record<string, number | undefined>)[scopeType] ?? Number.MAX_SAFE_INTEGER
  );
}

// ── Tool grant + resolver ───────────────────────────────────────────────────

/**
 * A per-tool authorization grant. Mirrors `ToolGrantInput` (packages/db/src/
 * schema/catalog.ts) — kept local so @arm/policy stays DB-free. Note:
 * `action: "*"` is a policy-layer wildcard; DB rows carry concrete verbs.
 */
export interface ToolGrant {
  scopeType: ScopeType;
  scopeId: string;
  principalId: string;
  toolId: string;
  action: ToolAction | "*";
  deny: boolean;
  expiresAt?: string; // ISO timestamp; expired grants are ignored
}

export interface ToolAccessDecision {
  decision: "allow" | "deny";
  reason: string;
  matchedGrant?: ToolGrant;
}

export interface ResolveToolAccessInput {
  grants: ToolGrant[];
  principalId: string;
  toolId: string;
  action: ToolAction;
  now?: Date;
}

/**
 * Resolves whether a principal may perform a tool action on a tool.
 *
 * Same deny-override algorithm as resolveAccess (Invariant §11.3), ranked
 * with TOOL_SCOPE_RANK:
 * 1. Filter to grants matching principal + tool + action (`*` matches any),
 *    ignoring expired grants.
 * 2. Among matching grants, the highest-authority (lowest rank) DENY wins.
 * 3. No deny → highest-authority ALLOW wins.
 * 4. No matching grants → deny (closed by default).
 */
export function resolveToolAccess(input: ResolveToolAccessInput): ToolAccessDecision {
  const now = input.now ?? new Date();

  const matching = input.grants.filter((g) => {
    if (g.principalId !== input.principalId) return false;
    if (g.toolId !== input.toolId) return false;
    if (g.action !== "*" && g.action !== input.action) return false;
    if (g.expiresAt && new Date(g.expiresAt) < now) return false;
    return true;
  });

  if (matching.length === 0) {
    return { decision: "deny", reason: "no_matching_tool_grant" };
  }

  // Highest-authority deny (lowest rank number).
  const denies = matching
    .filter((g) => g.deny)
    .sort((a, b) => toolScopeRank(a.scopeType) - toolScopeRank(b.scopeType));

  if (denies.length > 0) {
    const topDeny = denies[0]!;
    return {
      decision: "deny",
      reason: `higher_level_deny_at_${topDeny.scopeType}`,
      matchedGrant: topDeny,
    };
  }

  // No denies — any allow grants access; report the highest-authority one.
  const allows = matching.filter((g) => !g.deny);
  if (allows.length > 0) {
    const topAllow = allows.sort(
      (a, b) => toolScopeRank(a.scopeType) - toolScopeRank(b.scopeType),
    )[0]!;
    return {
      decision: "allow",
      reason: `granted_at_${topAllow.scopeType}`,
      matchedGrant: topAllow,
    };
  }

  return { decision: "deny", reason: "no_allow_found" };
}

// ── Package model routing (D9 model_routing) ────────────────────────────────

/** Package-level model routing (work_package_version.model_routing). */
export interface PackageModelRouting {
  allowed_models?: string[];
  auto_downgrade_to?: string;
}

export type ModelTier = "critical" | "standard" | "background";

export interface PackageModelDecision {
  model: string;
  downgraded: boolean;
  reason: string;
}

export interface ResolvePackageModelOpts {
  /** Agent/task tier — reserved for tiered approval defaults (D9 sub-dec 4). */
  tier?: ModelTier;
}

/**
 * Resolves which model an agent bound to a work package may use for a
 * request. Package policies gate capabilities, never expand them (D6 rule).
 *
 * Matching semantics mirror resolveLLMModel: exact model, `"*"`, or prefix
 * match `"self_hosted/*"` (any model under the `self_hosted/` namespace).
 *
 * Never throws: when the requested model is not allowed and no downgrade
 * target exists, the requested model is returned flagged by reason
 * `package_policy_block` — the caller decides how to surface the block.
 */
export function resolvePackageModel(
  routing: PackageModelRouting | undefined,
  requestedModel: string,
  opts?: ResolvePackageModelOpts,
): PackageModelDecision {
  void opts;
  if (routing === undefined) {
    return { model: requestedModel, downgraded: false, reason: "no_package_routing" };
  }

  const allowed = routing.allowed_models ?? [];
  const matches = allowed.some(
    (m) => m === requestedModel || m === "*" || requestedModel.startsWith(m.replace("/*", "/")),
  );
  if (matches) {
    return { model: requestedModel, downgraded: false, reason: "package_policy_allowed" };
  }

  if (routing.auto_downgrade_to) {
    return {
      model: routing.auto_downgrade_to,
      downgraded: true,
      reason: "package_policy_downgrade",
    };
  }

  return { model: requestedModel, downgraded: false, reason: "package_policy_block" };
}
