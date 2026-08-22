/**
 * guardrail: blob-residency (D10, guide 00 §9 — STUB, filled by `library`).
 *
 * Polices: no `component_blob` sourced from a `tenant_authored` component has
 * `residency = 'control_plane'` (Invariant 1 — packages/db/src/schema/
 * artifactory.ts `componentBlobTable.residency`, joined through
 * `componentVersionTable.blobDigest` to `componentTable.sourceKind`).
 * Tenant-authored content must stay in the tenant's own residency; only
 * first-party (ARM-shipped) blobs may sit at control-plane residency.
 *
 * `checkBlobResidency` is the real, testable rule (exercised by the mutation
 * proofs below). The REGISTERED check has nothing real to scan yet: no
 * component/component_blob fixtures exist in the repo until `library`
 * (Wave 1, docs/guides/01-library-artifactory.md) lands them. Per spec
 * §14.2 / AGENTS.md, this is reported HONESTLY as a vacuous failure until
 * that substrate exists.
 */

import { register, type CheckResult } from "../types.js";

export interface BlobResidencyRow {
  digest: string;
  sourceKind: string;
  residency: string;
}

/** Pure function form — used by mutation proofs. */
export function checkBlobResidency(rows: BlobResidencyRow[]): CheckResult {
  const violations = rows.filter(
    (r) => r.sourceKind === "tenant_authored" && r.residency === "control_plane",
  );
  if (violations.length > 0) {
    return {
      id: "blob-residency",
      status: "fail",
      detail: `tenant-authored blob(s) stored at control_plane residency (Invariant 1): ${violations
        .map((v) => v.digest)
        .join(", ")}`,
      scanned: rows.length,
      assertsNegative: true,
    };
  }
  return { id: "blob-residency", status: "pass", scanned: rows.length, assertsNegative: true };
}

register({
  id: "blob-residency",
  description:
    "No component_blob sourced from a tenant_authored component has residency = 'control_plane' (Invariant 1, D10).",
  invariant: "§11.1: prompt bodies + resource content never leave the tenant VPC",
  run: () => {
    // No real component/component_blob data exists yet — see file header.
    // Honest vacuous failure (spec §14.2), not a fabricated pass.
    return {
      id: "blob-residency",
      status: "fail",
      detail:
        "no component/component_blob fixtures found — awaiting `library` (Wave 1) to land " +
        "packages/artifactory fixtures; checkBlobResidency() is implemented and mutation-proofed " +
        "(scripts/guardrails/test/mutation-proofs.test.ts) and ready to wire up once real rows exist",
      scanned: 0,
      assertsNegative: true,
    };
  },
});
