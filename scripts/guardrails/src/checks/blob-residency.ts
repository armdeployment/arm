/**
 * guardrail: blob-residency (D10, guide 00 §9 — REAL, filled by `library`
 * per docs/guides/01-library-artifactory.md §8).
 *
 * Polices: no `component_blob` sourced from a `tenant_authored` component has
 * `residency = 'control_plane'` (Invariant 1 — packages/db/src/schema/
 * artifactory.ts `componentBlobTable.residency`, joined through
 * `componentVersionTable.blobDigest` to `componentTable.sourceKind`).
 * Tenant-authored content must stay in the tenant's own residency; only
 * first-party (ARM-shipped) blobs may sit at control-plane residency.
 *
 * `checkBlobResidency` is the real, testable rule (exercised by the mutation
 * proofs below — unchanged signature, still `BlobResidencyRow[]`). The
 * REGISTERED check now scans REAL substrate: `@arm/artifactory`'s shipped
 * `componentBlobFixtures` (one first-party/control_plane blob, one
 * tenant_authored/tenant blob — see that package's `fixtures.ts`), joined
 * through `componentVersionFixtures.blob_digest` to `componentFixtures.source_kind`.
 */

import { register, type CheckResult } from "../types.js";
import {
  componentFixtures,
  componentVersionFixtures,
  componentBlobFixtures,
} from "@arm/artifactory";

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
    // digest -> the component_version that references it -> its component's source_kind
    const componentById = new Map(componentFixtures.map((c) => [c.id, c]));
    const componentIdByDigest = new Map(
      componentVersionFixtures
        .filter((v) => v.blob_digest !== null)
        .map((v) => [v.blob_digest as string, v.component_id]),
    );
    const rows: BlobResidencyRow[] = componentBlobFixtures.map((blob) => {
      const componentId = componentIdByDigest.get(blob.digest);
      const sourceKind = componentId ? componentById.get(componentId)?.source_kind : undefined;
      return {
        digest: blob.digest,
        sourceKind: sourceKind ?? "unknown_dangling_ref",
        residency: blob.residency,
      };
    });
    return checkBlobResidency(rows);
  },
});
