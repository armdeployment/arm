/**
 * Local pull-through cache — digest-keyed, immutable, NO TTL (guide 01 §5).
 *
 * Content-addressed artifacts can never go stale, so a cache entry is
 * correct forever; the only reason to evict is the size cap (LRU). This is
 * a SEPARATE, independently-authored implementation from
 * `packages/artifactory/src/cache.ts` — this app cannot import
 * `@arm/artifactory` (data-plane boundary rule), so the small policy is
 * duplicated rather than shared.
 */

export interface CachedBlob {
  body: Uint8Array;
  mediaType: string;
}

export class LocalArtifactCache {
  private readonly maxBytes: number;
  private currentBytes = 0;
  private readonly store = new Map<string, CachedBlob>();

  constructor(maxBytes: number) {
    if (maxBytes <= 0)
      throw new Error(`LocalArtifactCache: maxBytes must be positive, got ${maxBytes}`);
    this.maxBytes = maxBytes;
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

  get(digest: string): CachedBlob | undefined {
    const entry = this.store.get(digest);
    if (entry === undefined) return undefined;
    this.store.delete(digest); // touch: refresh LRU recency
    this.store.set(digest, entry);
    return entry;
  }

  put(digest: string, entry: CachedBlob): void {
    const existing = this.store.get(digest);
    if (existing) {
      this.currentBytes -= existing.body.byteLength;
      this.store.delete(digest);
    }
    if (entry.body.byteLength > this.maxBytes) return; // too big to ever fit
    while (this.currentBytes + entry.body.byteLength > this.maxBytes && this.store.size > 0) {
      const oldestKey = this.store.keys().next().value as string;
      const oldest = this.store.get(oldestKey)!;
      this.currentBytes -= oldest.body.byteLength;
      this.store.delete(oldestKey);
    }
    this.store.set(digest, entry);
    this.currentBytes += entry.body.byteLength;
  }
}
