/**
 * Content-addressing for D9 Work Package manifests (spec §14.1 guardrail
 * `package-integrity`, docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * `manifestSha256` hashes the CANONICAL JSON encoding of a value: object keys
 * sorted recursively, no whitespace, spec-defined string escaping (ECMA-262
 * §24.5.2 JSON.stringify). Two semantically-equal values hash identically
 * regardless of key insertion order, so integrity checks survive JSON
 * round-trips and serializer differences.
 */

import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

/** sha256 hex digest of the canonical JSON encoding of `obj`. */
export function manifestSha256(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(obj))).digest("hex");
}
