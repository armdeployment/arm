/**
 * Pull-through cache policy (guide 01 §2 Slice A).
 *
 * Digest-keyed, immutable, NO TTL — content-addressed artifacts can never go
 * stale, so once a digest is cached it is correct forever; the only reason
 * to evict is the size cap. Eviction is LRU (least-recently-USED — a hit
 * refreshes recency, not just insertion order).
 *
 * This is the reusable in-process policy `@arm/artifactory` consumers use
 * (e.g. `resolve`/`publish` callers wanting a local cache in front of a
 * `StorageBackend`). It is a DISTINCT implementation from
 * `apps/data-plane/artifact-cache`'s own tiny cache — that app may not
 * import `@arm/artifactory` (data-plane boundary rule, guide 01 §5), so it
 * reimplements the same small policy locally rather than sharing this class.
 */

export interface DigestCacheEntry {
  body: Uint8Array;
  mediaType: string;
}

export interface DigestCacheOptions {
  /** Total cache size cap in bytes. */
  maxBytes: number;
}

/**
 * `fetcher(digest)` is called only on a cache miss — typically
 * `StorageBackend.get` + `.head`. A hit never re-fetches (immutability means
 * the cached bytes are always correct for that digest).
 */
export type DigestFetcher = (digest: string) => Promise<DigestCacheEntry>;

export class DigestCache {
  private readonly maxBytes: number;
  private currentBytes = 0;
  // Map iteration order = insertion order; re-inserting on access gives LRU
  // ordering (oldest-used first) for free.
  private readonly store = new Map<string, DigestCacheEntry>();

  constructor(opts: DigestCacheOptions) {
    if (opts.maxBytes <= 0) {
      throw new Error(`DigestCache: maxBytes must be positive, got ${opts.maxBytes}`);
    }
    this.maxBytes = opts.maxBytes;
  }

  has(digest: string): boolean {
    return this.store.has(digest);
  }

  size(): number {
    return this.store.size;
  }

  bytesUsed(): number {
    return this.currentBytes;
  }

  /** Direct read — does not fetch on miss. Refreshes LRU recency on hit. */
  peek(digest: string): DigestCacheEntry | undefined {
    const entry = this.store.get(digest);
    if (entry === undefined) return undefined;
    // touch: move to most-recently-used position
    this.store.delete(digest);
    this.store.set(digest, entry);
    return entry;
  }

  /** Insert or refresh an entry, evicting least-recently-used entries first
   *  if the cap would be exceeded. A single entry larger than the whole cap
   *  is simply not cached (fetcher result is still returned to the caller). */
  put(digest: string, entry: DigestCacheEntry): void {
    const existing = this.store.get(digest);
    if (existing) {
      this.currentBytes -= existing.body.byteLength;
      this.store.delete(digest);
    }
    if (entry.body.byteLength > this.maxBytes) {
      return; // too big to ever fit — not an error, just uncached
    }
    while (this.currentBytes + entry.body.byteLength > this.maxBytes && this.store.size > 0) {
      const oldestKey = this.store.keys().next().value as string;
      const oldest = this.store.get(oldestKey)!;
      this.currentBytes -= oldest.body.byteLength;
      this.store.delete(oldestKey);
    }
    this.store.set(digest, entry);
    this.currentBytes += entry.body.byteLength;
  }

  /** Get-or-fetch: serves from cache on hit, else calls `fetcher` and caches
   *  the result (digest-keyed, so the fetched bytes are trusted to match —
   *  callers should verify sha256 themselves before calling `put` if the
   *  source isn't already trusted, mirroring the artifact-cache app). */
  async getOrFetch(digest: string, fetcher: DigestFetcher): Promise<DigestCacheEntry> {
    const cached = this.peek(digest);
    if (cached) return cached;
    const fetched = await fetcher(digest);
    this.put(digest, fetched);
    return fetched;
  }
}
