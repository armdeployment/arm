/**
 * sha256 digest helpers (guide 01 §2 Slice A).
 *
 * The wire form is always `"sha256:<64-hex>"` — never a bare hex string, and
 * never a mutable URL (that's the invariant `artifact-integrity` polices).
 * Every artifact write path in this package computes and verifies against
 * this format; nothing here ever trusts a caller-declared digest without
 * recomputing it from the actual bytes.
 */

import { createHash } from "node:crypto";

/** `sha256:<hex>` — matches `@arm/proto`'s `componentBlobSchema.digest` regex. */
export const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** Compute the `sha256:<hex>` digest of a byte buffer. */
export function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Format a bare hex digest (or compute one from bytes) into wire form. */
export function formatDigest(hexOrBytes: string | Uint8Array): string {
  const hex = typeof hexOrBytes === "string" ? hexOrBytes : sha256Hex(hexOrBytes);
  return `sha256:${hex}`;
}

/** Compute the wire-form `sha256:<hex>` digest of a byte buffer directly. */
export function digestOf(body: Uint8Array): string {
  return formatDigest(sha256Hex(body));
}

export function isValidDigest(value: string): boolean {
  return DIGEST_RE.test(value);
}

/**
 * Parse a `sha256:<hex>` digest into its bare hex form. Throws on anything
 * else — including a bare hex string with no prefix, or a URL — so callers
 * fail loud rather than silently accepting a malformed reference.
 */
export function parseDigest(digest: string): string {
  if (!DIGEST_RE.test(digest)) {
    throw new Error(`not a well-formed sha256:<hex> digest: "${digest}"`);
  }
  return digest.slice("sha256:".length);
}

/** Assert that `body` hashes to `declaredDigest`; throws with both values on mismatch. */
export function assertDigestMatches(declaredDigest: string, body: Uint8Array): void {
  const actual = digestOf(body);
  if (actual !== declaredDigest) {
    throw new Error(
      `digest mismatch: declared ${declaredDigest}, computed ${actual} over ${body.byteLength} bytes`,
    );
  }
}
