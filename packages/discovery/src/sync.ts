/**
 * Poll a source → upsert `discovery_candidate` rows (guide 01 §6.2).
 *
 * Rule 1 (non-negotiable, tested): a synced candidate lands as a
 * `discovery_candidate`-shaped object, NEVER a component — this module has
 * no dependency on anything that could construct a `Component` row; its
 * return type is exclusively `DiscoveryCandidateUpsert`.
 *
 * Rule 5 (non-negotiable): adapters run on a worker schedule, not in a
 * request path — `syncSource` is the function a worker calls; nothing in
 * `library-router.ts`'s query procedures (`listSources`/`listCandidates`)
 * invokes it inline.
 */

import type { DiscoveryCandidateStatus, ComponentKind } from "@arm/proto";
import type { DiscoveredCandidate, DiscoverySourceAdapter, DiscoverySourceRef } from "./sources/types.js";

export interface ExistingCandidateRow {
  id: string;
  sourceId: string;
  externalRef: string;
  status: DiscoveryCandidateStatus;
}

export interface DiscoveryCandidateUpsert {
  /** Present only when refreshing a row that already exists. */
  id: string | null;
  sourceId: string;
  externalRef: string;
  proposedKind: ComponentKind;
  name: string;
  description: string;
  rawManifest: Record<string, unknown>;
  /** New rows start "new"; existing rows KEEP their current triage status —
   *  a re-sync must never silently reset something a human already
   *  triaged/promoted/rejected back to "new". */
  status: DiscoveryCandidateStatus;
}

export interface SyncResult {
  upserts: DiscoveryCandidateUpsert[];
  /** External refs seen this sync that already existed — for observability. */
  refreshedCount: number;
  newCount: number;
}

/**
 * Poll `source` through `adapter`, diff against `existing` rows for that
 * source, and produce the upsert set. Pure over its inputs (the adapter call
 * is the only I/O) — a worker wraps this with the actual DB write.
 */
export async function syncSource(
  source: DiscoverySourceRef & { id: string },
  adapter: DiscoverySourceAdapter,
  existing: readonly ExistingCandidateRow[],
  deps?: { fetchImpl?: typeof fetch },
): Promise<SyncResult> {
  const fetched: DiscoveredCandidate[] = await adapter.fetchCandidates(source, deps);
  const existingByRef = new Map(existing.filter((e) => e.sourceId === source.id).map((e) => [e.externalRef, e]));

  const upserts: DiscoveryCandidateUpsert[] = [];
  let newCount = 0;
  let refreshedCount = 0;

  for (const candidate of fetched) {
    const prior = existingByRef.get(candidate.externalRef);
    if (prior) {
      refreshedCount++;
      upserts.push({
        id: prior.id,
        sourceId: source.id,
        externalRef: candidate.externalRef,
        proposedKind: candidate.proposedKind,
        name: candidate.name,
        description: candidate.description,
        rawManifest: candidate.rawManifest,
        status: prior.status, // never regress a human triage decision
      });
    } else {
      newCount++;
      upserts.push({
        id: null,
        sourceId: source.id,
        externalRef: candidate.externalRef,
        proposedKind: candidate.proposedKind,
        name: candidate.name,
        description: candidate.description,
        rawManifest: candidate.rawManifest,
        status: "new",
      });
    }
  }

  return { upserts, refreshedCount, newCount };
}
