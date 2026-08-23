/**
 * Ranking — pure helpers over rows, unit-testable, no LLM anywhere on this
 * path (guide 01 §6.1).
 *
 * score = job-function match (weight 3) + same-department install count
 * (weight 2, log-dampened so a single popular department can't drown out
 * everything else) + review status `approved` (REQUIRED — non-approved
 * candidates are excluded entirely, not merely down-weighted) + recency
 * tiebreak (newer `publishedAt` wins). Deterministic ordering; final ties
 * broken by slug ascending.
 */

import type { ComponentReviewStatus } from "@arm/proto";

export interface RecommendCandidate {
  slug: string;
  jobFunctions: string[];
  reviewStatus: ComponentReviewStatus;
  /** Install counts keyed by org department id — same-department signal. */
  installCountByDepartment: Record<string, number>;
  /** ISO datetime, or null if never published. */
  publishedAt: string | null;
}

export interface RecommendInput {
  jobFunctionKey: string;
  /** The requesting user/agent's department — drives the same-department signal. */
  departmentId?: string;
}

export interface RankedCandidate {
  slug: string;
  score: number;
}

const JOB_FUNCTION_MATCH_WEIGHT = 3;
const DEPARTMENT_INSTALL_WEIGHT = 2;

/** log-dampened so 1 install ≈ 2 installs ≈ ... doesn't scale linearly forever. */
function departmentSignal(count: number): number {
  return count > 0 ? Math.log2(count + 1) : 0;
}

export function recommendForJobFunction(
  candidates: readonly RecommendCandidate[],
  input: RecommendInput,
): RankedCandidate[] {
  const approved = candidates.filter((c) => c.reviewStatus === "approved");

  const scored = approved.map((c) => {
    const jobFunctionScore = c.jobFunctions.includes(input.jobFunctionKey) ? JOB_FUNCTION_MATCH_WEIGHT : 0;
    const deptCount = input.departmentId ? (c.installCountByDepartment[input.departmentId] ?? 0) : 0;
    const departmentScore = departmentSignal(deptCount) * DEPARTMENT_INSTALL_WEIGHT;
    return { slug: c.slug, score: jobFunctionScore + departmentScore, publishedAt: c.publishedAt };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Recency tiebreak: newer publishedAt wins. Never-published sorts last.
      const at = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
      if (bt !== at) return bt - at;
      // Final deterministic tiebreak.
      return a.slug.localeCompare(b.slug);
    })
    .map(({ slug, score }) => ({ slug, score }));
}
