/**
 * guardrail: component-review (D10, guide 00 §9 — STUB, filled by `library`).
 *
 * Polices: no `work_package_version.components` entry references a component
 * whose `review_status ≠ approved` (packages/db/src/schema/artifactory.ts
 * `componentTable.reviewStatus`, packages/db/src/schema/catalog.ts
 * `workPackageVersionTable.components`).
 *
 * `checkComponentReview` is the real, testable rule (exercised by the
 * mutation proofs below). The REGISTERED check has nothing real to scan yet:
 * no component/work_package_version fixtures exist in the repo until
 * `library` (Wave 1, docs/guides/01-library-artifactory.md) lands them in
 * `packages/artifactory`. Per spec §14.2 / AGENTS.md ("a lint that scans
 * zero files is red, not green"), this is reported HONESTLY as a vacuous
 * failure — not silently skipped or faked green — until that substrate
 * exists.
 */

import { register, type CheckResult } from "../types.js";

export interface ComponentRefWithStatus {
  componentId: string;
  reviewStatus: string;
}

/** Pure function form — used by mutation proofs. */
export function checkComponentReview(refs: ComponentRefWithStatus[]): CheckResult {
  const violations = refs.filter((r) => r.reviewStatus !== "approved");
  if (violations.length > 0) {
    return {
      id: "component-review",
      status: "fail",
      detail: `work_package_version.components references non-approved component(s): ${violations
        .map((v) => `${v.componentId} (review_status=${v.reviewStatus})`)
        .join(", ")}`,
      scanned: refs.length,
      assertsNegative: true,
    };
  }
  return { id: "component-review", status: "pass", scanned: refs.length, assertsNegative: true };
}

register({
  id: "component-review",
  description:
    "No work_package_version.components entry references a component whose review_status is not 'approved' (D10).",
  invariant: "D10: guide 00 §9 — component publish→approve workflow gate",
  run: () => {
    // No real component/work_package_version data exists yet — see file
    // header. Honest vacuous failure (spec §14.2), not a fabricated pass.
    return {
      id: "component-review",
      status: "fail",
      detail:
        "no component/work_package_version fixtures found — awaiting `library` (Wave 1) to land " +
        "packages/artifactory fixtures; checkComponentReview() is implemented and mutation-proofed " +
        "(scripts/guardrails/test/mutation-proofs.test.ts) and ready to wire up once real rows exist",
      scanned: 0,
      assertsNegative: true,
    };
  },
});
