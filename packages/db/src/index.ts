/**
 * ARM OLTP schema (spec §4.1). Postgres + Drizzle.
 *
 * Schema-level invariants enforced here (see docs/arm-spec.md §11):
 *   - §11.2: Agent.id 1:1 SubAccount (subAccountId unique).
 *   - §11.6 + D1-b: every multi-tenant table carries tenant_id NOT NULL.
 *   - §11.7: Agent.stakeholderUserId NOT NULL.
 *   - §11.8: Agent.priorityTier default 'standard'.
 *
 * Invariants NOT enforceable at the schema level (policy-layer only):
 *   - §11.1 prompt bodies never leave VPC
 *   - §11.3 higher-level deny always wins (resolver; property-tested)
 *   - §11.4 short-lived credentials (connector-layer)
 *   - §11.5 hybrid IdP (issuer-layer)
 *
 * Those map to executable guardrails (spec §14.1), not constraints.
 */

export * from "./schema/enums.js";
export * from "./schema/org-tree.js";
export * from "./schema/identity.js";
export * from "./schema/policy.js";
export * from "./schema/access.js";

import * as schemaNs from "./schema/index.js";
/** Namespace view of all tables — for introspection (guardrails, drizzle-kit). */
export const schema = schemaNs;
