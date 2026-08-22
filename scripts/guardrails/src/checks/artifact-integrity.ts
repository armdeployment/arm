/**
 * guardrail: artifact-integrity (D10, guide 00 §9 — STUB, filled by `library`).
 *
 * Polices: every `component_version` with a blob has a `sha256:<hex>` digest;
 * no manifest contains a mutable URL where a digest belongs
 * (packages/db/src/schema/artifactory.ts `componentVersionTable.blobDigest`).
 *
 * `checkArtifactIntegrity` is the real, testable rule (exercised by the
 * mutation proofs below). The REGISTERED check has nothing real to scan yet:
 * no component_version fixtures exist in the repo until `library` (Wave 1,
 * docs/guides/01-library-artifactory.md) lands them. Per spec §14.2 /
 * AGENTS.md, this is reported HONESTLY as a vacuous failure until that
 * substrate exists.
 */

import { register, type CheckResult } from "../types.js";

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
    // No real component_version data exists yet — see file header. Honest
    // vacuous failure (spec §14.2), not a fabricated pass.
    return {
      id: "artifact-integrity",
      status: "fail",
      detail:
        "no component_version fixtures found — awaiting `library` (Wave 1) to land " +
        "packages/artifactory fixtures; checkArtifactIntegrity() is implemented and mutation-proofed " +
        "(scripts/guardrails/test/mutation-proofs.test.ts) and ready to wire up once real rows exist",
      scanned: 0,
      assertsNegative: true,
    };
  },
});
