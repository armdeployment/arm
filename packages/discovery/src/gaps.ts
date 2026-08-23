/**
 * Gap analysis — job functions with headcount weight but zero published
 * packages, ranked by weight (guide 01 §6.1). This is the product-critical
 * output: it feeds `/adoption` and the roadmap.
 */

export interface JobFunctionCoverage {
  key: string;
  headcountWeight: number;
}

export interface PackageJobFunctionRow {
  packageId: string;
  jobFunctions: string[];
}

export interface CoverageGap {
  key: string;
  headcountWeight: number;
}

/** Job functions with `headcountWeight > 0` and no work package covering
 *  them (via any published version's `job_functions`), ranked by weight
 *  descending. Ties broken by key ascending for determinism. */
export function computeGaps(
  jobFunctions: readonly JobFunctionCoverage[],
  packages: readonly PackageJobFunctionRow[],
): CoverageGap[] {
  const covered = new Set<string>();
  for (const p of packages) {
    for (const key of p.jobFunctions) covered.add(key);
  }

  return jobFunctions
    .filter((jf) => jf.headcountWeight > 0 && !covered.has(jf.key))
    .map((jf) => ({ key: jf.key, headcountWeight: jf.headcountWeight }))
    .sort((a, b) => b.headcountWeight - a.headcountWeight || a.key.localeCompare(b.key));
}
