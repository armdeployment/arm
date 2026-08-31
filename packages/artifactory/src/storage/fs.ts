/**
 * Filesystem StorageBackend — the dev + self-hosted default (guide 01 §2.1).
 *
 * Layout: `<baseDir>/<algo>/<hex[0:2]>/<hex[2:4]>/<hex>.bin` (git-style
 * fan-out so a single directory never holds millions of entries) plus a
 * sibling `.meta.json` recording `{ mediaType, size }`.
 *
 * `presignGet` does NOT return a file:// path — the guide requires "a signed
 * local URL served by the data-plane artifact cache" (`apps/data-plane/artifact-cache`,
 * guide 01 §5). The signature here is an HMAC over `${digest}.${exp}` using
 * an injected key (never hardcoded — the constructor default is an
 * explicitly-labeled DEV-ONLY placeholder, not a production secret; a real
 * deployment injects its own key). The artifact-cache service verifies the
 * signature the same way before serving bytes.
 */

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHmac, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import type { StorageBackend } from "./backend.js";
import { assertDigestMatches, parseDigest } from "../digest.js";

/** NOT a real secret — a labeled dev/test default. Production callers MUST
 *  inject their own signing key via the constructor. */
export const DEV_PLACEHOLDER_SIGNING_KEY = "arm-fs-backend-dev-unsigned-key";

export interface FsBackendOptions {
  baseDir: string;
  /** The artifact-cache origin that serves presigned URLs, e.g. "http://localhost:8790". */
  artifactCacheOrigin?: string;
  signingKey?: string;
}

function digestPath(baseDir: string, digest: string, suffix: string): string {
  const hex = parseDigest(digest);
  return join(baseDir, "sha256", hex.slice(0, 2), hex.slice(2, 4), `${hex}${suffix}`);
}

interface BlobMeta {
  mediaType: string;
  size: number;
}

export class FsStorageBackend implements StorageBackend {
  readonly kind = "fs" as const;
  private readonly baseDir: string;
  private readonly artifactCacheOrigin: string;
  private readonly signingKey: string;

  constructor(opts: FsBackendOptions) {
    this.baseDir = opts.baseDir;
    this.artifactCacheOrigin = opts.artifactCacheOrigin ?? "http://localhost:8790";
    this.signingKey = opts.signingKey ?? DEV_PLACEHOLDER_SIGNING_KEY;
  }

  async put(digest: string, body: Uint8Array, mediaType: string): Promise<void> {
    assertDigestMatches(digest, body);
    const existing = await this.head(digest);
    if (existing !== null && existing.size === body.byteLength) {
      return; // idempotent no-op
    }
    const dataPath = digestPath(this.baseDir, digest, ".bin");
    const metaPath = digestPath(this.baseDir, digest, ".meta.json");
    await mkdir(join(dataPath, ".."), { recursive: true });
    await writeFile(dataPath, body);
    const meta: BlobMeta = { mediaType, size: body.byteLength };
    await writeFile(metaPath, JSON.stringify(meta));
  }

  async get(digest: string): Promise<Uint8Array> {
    const dataPath = digestPath(this.baseDir, digest, ".bin");
    return new Uint8Array(await readFile(dataPath));
  }

  async head(digest: string): Promise<{ size: number; mediaType: string } | null> {
    const metaPath = digestPath(this.baseDir, digest, ".meta.json");
    try {
      const raw = await readFile(metaPath, "utf8");
      const meta = JSON.parse(raw) as BlobMeta;
      // Cross-check against the actual file size on disk (defense against a
      // hand-edited/corrupt sidecar) rather than trusting the sidecar alone.
      const dataPath = digestPath(this.baseDir, digest, ".bin");
      const stats = await stat(dataPath);
      return { size: stats.size, mediaType: meta.mediaType };
    } catch {
      return null;
    }
  }

  private sign(digest: string, exp: number): string {
    return createHmac("sha256", this.signingKey).update(`${digest}.${exp}`).digest("hex");
  }

  async presignGet(digest: string, ttlSeconds: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(digest, exp);
    return `${this.artifactCacheOrigin}/artifacts/${encodeURIComponent(digest)}?exp=${exp}&sig=${sig}`;
  }

  /** Verify a presigned URL's signature + expiry — used by the artifact-cache
   *  service's own (independently-implemented, non-imported) verifier tests,
   *  and by this package's own tests. Not part of the StorageBackend interface. */
  verifyPresignedSignature(
    digest: string,
    exp: number,
    sig: string,
    nowSeconds = Math.floor(Date.now() / 1000),
  ): boolean {
    if (nowSeconds > exp) return false;
    const expected = Buffer.from(this.sign(digest, exp), "hex");
    const actual = Buffer.from(sig, "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
