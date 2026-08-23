/**
 * StorageBackend — the pluggable blob backend interface (guide 01 §2.1, A2).
 *
 * Every backend implementation must be:
 *   - IDEMPOTENT: `put` of the same digest twice (same size) is a no-op.
 *   - VERIFYING: `put` recomputes sha256 of `body` and throws if it doesn't
 *     match `digest` — a backend never trusts a caller-declared digest.
 *   - NON-DELETING: no backend method ever deletes content. Yanking a
 *     component_version is metadata (`yanked = true`), never a blob delete —
 *     content-addressed artifacts referenced by an immutable manifest must
 *     stay resolvable for audit/rollback even after a yank.
 *
 * `packages/artifactory/test/storage-contract.test.ts` runs the SAME
 * contract test suite against every backend so behavior stays identical
 * regardless of which one a tenant configures.
 */

export interface StorageBackend {
  readonly kind: "fs" | "s3" | "oci";

  /**
   * Store `body` under `digest`. MUST recompute sha256(body) and throw if it
   * does not equal `digest`. If content already exists at `digest` with the
   * same size, this is a no-op (idempotent).
   */
  put(digest: string, body: Uint8Array, mediaType: string): Promise<void>;

  /** Retrieve the bytes stored at `digest`. Throws if not found. */
  get(digest: string): Promise<Uint8Array>;

  /** Metadata only (no body transfer). `null` if `digest` is not stored. */
  head(digest: string): Promise<{ size: number; mediaType: string } | null>;

  /**
   * A time-limited URL a client can GET the blob from directly, without
   * routing bytes back through this process. `ttlSeconds` bounds validity;
   * implementations MUST NOT return a URL usable past that window.
   */
  presignGet(digest: string, ttlSeconds: number): Promise<string>;
}

export class NotImplementedError extends Error {
  constructor(backend: string, method: string) {
    super(`${backend} storage backend: ${method} is not implemented (out of scope — guide 01 §2)`);
    this.name = "NotImplementedError";
  }
}
