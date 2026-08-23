/**
 * guardrail: artifact-integrity (D10, guide 00 §9 — REAL, filled by `library`
 * per docs/guides/01-library-artifactory.md §8).
 *
 * Polices: every `component_version` with a blob has a `sha256:<hex>` digest;
 * no manifest contains a mutable URL where a digest belongs
 * (packages/db/src/schema/artifactory.ts `componentVersionTable.blobDigest`).
 *
 * `checkArtifactIntegrity` is the real, testable rule (exercised by the
 * mutation proofs below — unchanged signature, still
 * `ComponentVersionBlobRef[]`). The REGISTERED check now scans REAL
 * substrate: every row of `@arm/artifactory`'s shipped
 * `componentVersionFixtures` (78 components, 80 versions, 2 of them
 * blob-bearing with real sha256 digests — see that package's `fixtures.ts`).
 */

import { register, type CheckResult } from "../types.js";
import { componentVersionFixtures } from "@arm/artifactory";

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
/** A digest field holding an http(s)/ftp URL instead of a content hash —
 *  exactly the "mutable URL where a digest belongs" failure mode. */
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;

export interface ComponentVersionBlobRef {
  componentVersionId: string;
  blobDigest: string | null;
}

/** Pure function form — used by mutation proofs. */
export function checkArtifactIntegrity(versions: ComponentVersionBlobRef[]): CheckResult {
  const violations: string[] = [];
  for (const v of versions) {
    if (v.blobDigest === null) continue; // no-blob (manifest-only) component version — fine
    if (URL_LIKE.test(v.blobDigest)) {
      violations.push(
        `${v.componentVersionId}: blob_digest is a mutable URL ("${v.blobDigest}"), not a content hash`,
      );
    } else if (!DIGEST_RE.test(v.blobDigest)) {
      violations.push(
        `${v.componentVersionId}: blob_digest "${v.blobDigest}" is not a well-formed sha256:<hex> digest`,
      );
    }
  }
  if (violations.length > 0) {
    return {
      id: "artifact-integrity",
      status: "fail",
      detail: violations.join("; "),
      scanned: versions.length,
      assertsNegative: true,
    };
  }
  return { id: "artifact-integrity", status: "pass", scanned: versions.length, assertsNegative: true };
}

register({
  id: "artifact-integrity",
  description:
    "Every component_version with a blob has a well-formed sha256:<hex> digest; no manifest carries a mutable URL where a digest belongs (D10).",
  invariant: "D10: guide 00 §9 — content-addressed artifact storage (A2)",
  run: () => {
    const versions: ComponentVersionBlobRef[] = componentVersionFixtures.map((v) => ({
      componentVersionId: v.id,
      blobDigest: v.blob_digest,
    }));
    return checkArtifactIntegrity(versions);
  },
});
