/**
 * Scope authority ranks — single source of truth (spec §6.1).
 *
 * Lower = more authoritative (Org root = 0). The org → workstream core
 * values are frozen (tests depend on them); manufacturing-deep scopes
 * (D6/D9 plant hierarchies) slot in at ranks that keep the total ordering:
 * `plant` (0.5) sits between org and department — a plant deny outranks a
 * department allow, matching the org-tree shape where plants live directly
 * under HQ/org. `line`/`cell`/`station` extend below workstream.
 *
 * This module is PURE LOGIC — no DB imports. `resolveAccess` and
 * `resolveToolAccess` must both rank with this map so the same grant
 * resolves identically in both resolvers.
 */

export type ScopeType =
  | "org"
  | "organization"
  | "hq"
  | "plant"
  | "department"
  | "group"
  | "team"
  | "workstream"
  | "line"
  | "cell"
  | "station";

/** Authority rank: lower = more authoritative (Org root = 0). */
export const SCOPE_RANK: Record<ScopeType, number> = {
  org: 0,
  organization: 0,
  hq: 0.25,
  plant: 0.5,
  department: 1,
  group: 2,
  team: 3,
  workstream: 4,
  line: 5.5,
  cell: 6.5,
  station: 7.5,
};

/** Alias of SCOPE_RANK — tool grants share the exact same total ordering. */
export const TOOL_SCOPE_RANK: Record<ScopeType, number> = SCOPE_RANK;
