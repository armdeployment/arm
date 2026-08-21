/**
 * Content-addressing for package manifests (D9 §package-integrity).
 *
 * The canonicalization contract is shared with `@arm/catalog`: every manifest
 * hash is computed over the canonical JSON form — object keys sorted
 * lexicographically at every depth, arrays in given order, no whitespace —
 * then sha256 hashed (hex). Any serializer that follows these three rules
 * produces byte-identical output, so client and control plane always agree.
 */

import { createHash } from "node:crypto";

/**
 * Recursively sort object keys so serialization order cannot change the hash.
 * Arrays keep their element order (order is semantically meaningful there).
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((key) => [key, sortKeysDeep(record[key])]),
    );
  }
  return value;
}

/**
 * Canonical JSON serialization: sorted keys, zero whitespace.
 * Byte-identical to @arm/catalog's canonicalization.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value)) ?? "null";
}

/**
 * sha256 (hex) over the canonical JSON form of `obj`.
 * Deterministic regardless of key insertion order.
 */
export function manifestSha256(obj: unknown): string {
  return createHash("sha256").update(canonicalize(obj), "utf8").digest("hex");
}
