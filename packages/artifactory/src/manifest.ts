/**
 * Component manifest canonicalization + hashing (guide 01 §2 Slice A).
 *
 * A `component_version.manifest` is a free-form JSON object (config schema
 * shape, capability description, etc. — `@arm/proto`'s `componentVersionSchema.manifest`,
 * `z.record(z.string(), z.unknown())`). `manifest_sha256` covers the
 * CANONICAL encoding: object keys sorted recursively, arrays hashed in the
 * order given (callers pre-sort where order matters — mirrors
 * `packages/catalog/src/hash.ts` and the manifest-v2 golden-vector
 * convention in `packages/proto/test/manifest-v2-golden.test.ts`), no
 * whitespace. Two semantically-equal manifests hash identically regardless
 * of key insertion order.
 */

import { createHash } from "node:crypto";

/** Recursively sort object keys; arrays are left in caller-given order. */
export function canonicalizeComponentManifest(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeComponentManifest);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined) out[key] = canonicalizeComponentManifest(v);
    }
    return out;
  }
  return value;
}

/** sha256 hex digest of the canonical JSON encoding of a component manifest. */
export function componentManifestSha256(manifest: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeComponentManifest(manifest)))
    .digest("hex");
}
