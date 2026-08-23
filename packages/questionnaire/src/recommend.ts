/**
 * Ranked job functions + catalog index → ranked packages
 * (docs/guides/03-client-downloader.md §2.1).
 *
 * PURE — same rules as score.ts. The "catalog index" is passed in as a
 * plain data argument rather than fetched, so this stays a pure function of
 * its inputs (the caller, e.g. `onboarding-router.ts`, builds the index from
 * `@arm/catalog`/`@arm/db` once per call).
 *
 * Ranking: (1) exact job-function match, (2) headcount fit, (3) package
 * version recency, (4) slug — descending on 1–3, ascending on 4 as the final
 * tie-break, so the result is fully deterministic.
 */

import type { RankedJobFunction } from "./score.js";

/** One eligible work-package version, pre-joined by the caller against
 *  `work_package_job_function` / `work_package_version.job_functions`. */
export interface CatalogPackageEntry {
  packageId: string;
  packageVersionId: string;
  /** `work_package.role_key` — stable slug for display + tie-breaking. */
  slug: string;
  name: string;
  /** Job function keys this package version targets. */
  jobFunctions: string[];
  /** Org headcount this package is sized/recommended for (0 = unspecified). */
  headcountFit: number;
  /** ISO publish timestamp of this version — recency tie-break. */
  publishedAt: string;
  /** Whether the current user/org is eligible for this package (caller-computed). */
  eligible: boolean;
  approvalRequired: boolean;
}

export interface CatalogIndex {
  packages: CatalogPackageEntry[];
}

export interface RecommendedPackage {
  packageId: string;
  packageVersionId: string;
  slug: string;
  name: string;
  exactMatch: boolean;
  approvalRequired: boolean;
}

/**
 * Map the top-ranked job function (and runners-up, as a fallback pool) to
 * eligible packages, ranked by (exact job-function match desc, headcount
 * fit desc, version recency desc, slug asc).
 */
export function recommend(
  rankedJobFunctions: RankedJobFunction[],
  catalog: CatalogIndex,
): RecommendedPackage[] {
  if (rankedJobFunctions.length === 0) return [];

  const rankByJobFunction = new Map(rankedJobFunctions.map((jf, index) => [jf.key, index]));

  const eligible = catalog.packages.filter((pkg) => pkg.eligible);

  return [...eligible]
    .map((pkg) => {
      const bestRank = pkg.jobFunctions.reduce<number>((best, key) => {
        const rank = rankByJobFunction.get(key);
        return rank !== undefined && rank < best ? rank : best;
      }, Number.POSITIVE_INFINITY);
      return { pkg, bestRank, exactMatch: bestRank === 0 };
    })
    .filter((entry) => entry.bestRank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => {
      if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank; // lower rank index = better match
      if (b.pkg.headcountFit !== a.pkg.headcountFit) return b.pkg.headcountFit - a.pkg.headcountFit;
      if (a.pkg.publishedAt !== b.pkg.publishedAt) {
        return a.pkg.publishedAt < b.pkg.publishedAt ? 1 : -1; // more recent first
      }
      return a.pkg.slug < b.pkg.slug ? -1 : a.pkg.slug > b.pkg.slug ? 1 : 0;
    })
    .map(({ pkg, exactMatch }) => ({
      packageId: pkg.packageId,
      packageVersionId: pkg.packageVersionId,
      slug: pkg.slug,
      name: pkg.name,
      exactMatch,
      approvalRequired: pkg.approvalRequired,
    }));
}
