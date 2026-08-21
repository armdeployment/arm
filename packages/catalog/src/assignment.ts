/**
 * D9 Package Assignment — approval state machine + org-node resolution
 * (docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * `transitionAssignment` encodes the lifecycle: requested → approved →
 * active → revoked, with revoked terminal. Approval requires an accountable
 * approver (stakeholder sign-off, Invariant 7 spirit). The returned patch
 * contains only the fields that change, so callers can `.set()` it as a
 * partial update without wiping approver state.
 *
 * `resolveAssignmentForOrgNode` implements org-node bulk assignment
 * semantics: an assignment on a node covers every node on its subtree path;
 * active assignments win, ties break toward the closest (deepest) node.
 */

import type { PackageAssignmentStatus } from "@arm/proto";

export interface AssignmentStatusPatch {
  status: PackageAssignmentStatus;
  approverUserId?: string;
  approvedAt?: Date;
}

export interface AssignmentLike {
  assigneeId: string;
  status: PackageAssignmentStatus;
}

const LEGAL_TRANSITIONS: Record<PackageAssignmentStatus, ReadonlySet<PackageAssignmentStatus>> = {
  requested: new Set(["approved", "revoked"]),
  approved: new Set(["active", "revoked"]),
  active: new Set(["revoked"]),
  revoked: new Set(),
};

const STATUS_PRIORITY: Record<PackageAssignmentStatus, number> = {
  active: 0,
  approved: 1,
  requested: 2,
  revoked: 3,
};

/**
 * Transition an assignment between lifecycle statuses. Throws on illegal
 * transitions and on approval without an approver.
 */
export function transitionAssignment(
  a: { status: PackageAssignmentStatus },
  to: PackageAssignmentStatus,
  approverUserId: string | null,
  now?: Date,
): AssignmentStatusPatch {
  if (!LEGAL_TRANSITIONS[a.status].has(to)) {
    throw new Error(`illegal package-assignment transition: ${a.status} → ${to}`);
  }
  if (a.status === "requested" && to === "approved") {
    if (approverUserId === null) {
      throw new Error("requested → approved requires an approver (approverUserId)");
    }
    return { status: to, approverUserId, approvedAt: now ?? new Date() };
  }
  return { status: to };
}

/**
 * Resolve which assignment applies to an org-tree node. Only assignments
 * whose assigneeId lies on the node's path to the root are candidates;
 * active beats approved beats requested beats revoked, then the deepest
 * (most specific) node wins.
 */
export function resolveAssignmentForOrgNode<T extends AssignmentLike>(
  assignments: readonly T[],
  orgNodePath: readonly string[],
): T | undefined {
  const depthByNode = new Map<string, number>();
  orgNodePath.forEach((nodeId, index) => depthByNode.set(nodeId, index));
  const matches = assignments.filter((a) => depthByNode.has(a.assigneeId));
  if (matches.length === 0) return undefined;
  return [...matches].sort((x, y) => {
    const byStatus = STATUS_PRIORITY[x.status] - STATUS_PRIORITY[y.status];
    if (byStatus !== 0) return byStatus;
    return (depthByNode.get(y.assigneeId) ?? -1) - (depthByNode.get(x.assigneeId) ?? -1);
  })[0];
}
