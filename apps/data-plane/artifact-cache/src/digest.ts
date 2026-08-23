/**
 * sha256 digest verification — COPIED from `packages/artifactory/src/digest.ts`
 * (guide 01 §5), not imported. `apps/data-plane/artifact-cache` may only
 * import `@arm/proto`/`@arm/config` (the data-plane boundary rule,
 * `scripts/guardrails/src/checks/boundaries.ts` — data-plane apps must not
 * import control-plane-only packages, and `@arm/artifactory` is control-
 * plane-only despite being "just" digest math). Keep this file's behavior
 * identical to the artifactory original if either one changes.
 */

import { createHash } from "node:crypto";

export const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function digestOf(body: Uint8Array): string {
  return `sha256:${sha256Hex(body)}`;
}

export function isValidDigest(value: string): boolean {
  return DIGEST_RE.test(value);
}

/** Verify `body` hashes to `declaredDigest`. Never re-signs or rewrites —
 *  either the bytes match the digest the client asked for, or they are
 *  refused outright (guide 01 §5: "Verify sha256 on every fill before
 *  caching. Never re-sign, never rewrite."). */
export function verifyDigest(declaredDigest: string, body: Uint8Array): boolean {
  return digestOf(body) === declaredDigest;
}
