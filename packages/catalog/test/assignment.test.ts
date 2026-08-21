/**
 * Tests for package assignment transitions + org-node resolution (D9).
 *
 * Verifies:
 *   1. The full legal chain requested → approved → active → revoked.
 *   2. Illegal transitions throw with a clear message.
 *   3. requested → approved without an approver throws.
 *   4. An explicit `now` is honored for approvedAt.
 *   5. Org-node resolution matches path members, active first, depth tiebreak.
 */

import { describe, it, expect } from "vitest";
import { transitionAssignment, resolveAssignmentForOrgNode } from "../src/index.js";

describe("transitionAssignment", () => {
  it("walks the full legal chain requested → approved → active → revoked", () => {
    const approved = transitionAssignment({ status: "requested" }, "approved", "approver-1");
    expect(approved.status).toBe("approved");
    expect(approved.approverUserId).toBe("approver-1");
    expect(approved.approvedAt).toBeInstanceOf(Date);

    const active = transitionAssignment({ status: "approved" }, "active", null);
    expect(active.status).toBe("active");

    const revoked = transitionAssignment({ status: "active" }, "revoked", null);
    expect(revoked.status).toBe("revoked");
  });

  it("allows direct revocations from requested and approved", () => {
    expect(transitionAssignment({ status: "requested" }, "revoked", null).status).toBe("revoked");
    expect(transitionAssignment({ status: "approved" }, "revoked", null).status).toBe("revoked");
  });

  it("throws on illegal transitions", () => {
    expect(() => transitionAssignment({ status: "requested" }, "active", "a")).toThrow(/illegal/);
    expect(() => transitionAssignment({ status: "approved" }, "requested", "a")).toThrow(/illegal/);
    expect(() => transitionAssignment({ status: "active" }, "approved", "a")).toThrow(/illegal/);
    expect(() => transitionAssignment({ status: "revoked" }, "approved", "a")).toThrow(/illegal/);
    expect(() => transitionAssignment({ status: "active" }, "active", null)).toThrow(/illegal/);
  });

  it("throws when requested → approved has no approver", () => {
    expect(() => transitionAssignment({ status: "requested" }, "approved", null)).toThrow(
      /requires an approver/,
    );
  });

  it("honors an explicit `now` for approvedAt", () => {
    const at = new Date("2026-08-13T12:00:00.000Z");
    const patch = transitionAssignment({ status: "requested" }, "approved", "approver-1", at);
    expect(patch.approvedAt).toBe(at);
  });
});

describe("resolveAssignmentForOrgNode", () => {
  const assignments = [
    { assigneeId: "root", status: "approved" as const },
    { assigneeId: "dept", status: "active" as const },
    { assigneeId: "other", status: "active" as const },
  ];

  it("matches assignments whose assigneeId lies on the org-node path", () => {
    const hit = resolveAssignmentForOrgNode(assignments, ["org", "root", "dept"]);
    expect(hit?.assigneeId).toBe("dept");
  });

  it("prefers active over approved on the same node", () => {
    const dupes = [
      { assigneeId: "root", status: "approved" as const },
      { assigneeId: "root", status: "active" as const },
    ];
    expect(resolveAssignmentForOrgNode(dupes, ["root"])?.status).toBe("active");
  });

  it("breaks status ties toward the deepest path node", () => {
    const ties = [
      { assigneeId: "root", status: "active" as const },
      { assigneeId: "dept", status: "active" as const },
    ];
    expect(resolveAssignmentForOrgNode(ties, ["root", "dept"])?.assigneeId).toBe("dept");
  });

  it("returns undefined when nothing matches the path", () => {
    expect(resolveAssignmentForOrgNode(assignments, ["nope"])).toBeUndefined();
  });
});
