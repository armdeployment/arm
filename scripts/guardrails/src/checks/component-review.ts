/**
 * guardrail: component-review (D10, guide 00 §9 — REAL, filled by `library`
 * per docs/guides/01-library-artifactory.md §8).
 *
 * Polices: no `work_package_version.components` entry references a component
 * whose `review_status ≠ approved` (packages/db/src/schema/artifactory.ts
 * `componentTable.reviewStatus`, packages/db/src/schema/catalog.ts
 * `workPackageVersionTable.components`).
 *
 * `checkComponentReview` is the real, testable rule (exercised by the
 * mutation proofs below — unchanged signature, still `ComponentRefWithStatus[]`).
 * The REGISTERED check now scans REAL substrate: every `components[]` entry
 * across `@arm/catalog`'s shipped `packageVersionFixtures`, joined against
 * `@arm/artifactory`'s shipped `componentFixtures` by `component_id` to read
 * each pinned component's actual `review_status`. A pin with no matching
 * component fixture is itself a violation (dangling ref — treated as
 * non-approved, since an unknown component can never be "approved").
 */

import { register, type CheckResult } from "../types.js";
import { packageVersionFixtures } from "@arm/catalog";
import { componentFixtures } from "@arm/artifactory";

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
    const componentById = new Map(componentFixtures.map((c) => [c.id, c]));
    const refs: ComponentRefWithStatus[] = packageVersionFixtures.flatMap((v) =>
      v.components.map((ref) => ({
        componentId: ref.component_id,
        reviewStatus: componentById.get(ref.component_id)?.review_status ?? "unknown_dangling_ref",
      })),
    );
    return checkComponentReview(refs);
  },
});
