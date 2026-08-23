/**
 * Facet counts — kind, job function, data classification, mode, source
 * (guide 01 §6.1). Pure function over the same rows `search.ts` consumes.
 */

import type { SearchableComponentRow, SearchableWorkPackageRow } from "./search.js";

export interface Facets {
  kind: Record<string, number>;
  jobFunction: Record<string, number>;
  classification: Record<string, number>;
  mode: Record<string, number>;
  source: Record<string, number>;
}

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function computeFacets(
  components: readonly SearchableComponentRow[],
  workPackages: readonly SearchableWorkPackageRow[],
): Facets {
  const facets: Facets = { kind: {}, jobFunction: {}, classification: {}, mode: {}, source: {} };

  for (const c of components) {
    if (c.reviewStatus !== "approved") continue;
    bump(facets.kind, c.kind);
    bump(facets.classification, c.dataClassification);
    bump(facets.source, c.sourceKind);
    for (const jf of c.jobFunctions) bump(facets.jobFunction, jf);
  }
  for (const w of workPackages) {
    bump(facets.mode, w.mode);
    for (const jf of w.jobFunctions) bump(facets.jobFunction, jf);
  }

  return facets;
}
