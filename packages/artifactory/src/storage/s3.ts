/**
 * S3-compatible StorageBackend — the SaaS backend (guide 01 §2.1).
 *
 * `packages/artifactory`'s declared deps are `@arm/proto`/`@arm/config`/`@arm/db`
 * only (guide 01 §2) — no AWS SDK. This backend is transport-agnostic: it
 * talks to any S3-compatible endpoint over plain HTTP via the global `fetch`,
 * and defers REQUEST SIGNING to an injected `S3RequestSigner` port (SigV4 or
 * whatever the deployment's credential broker produces) rather than
 * embedding credential handling here — this package never sees a secret key
 * (Invariant 4: short-lived credentials everywhere credentials are minted).
 *
 * `fetchImpl` is injectable so the storage-contract test suite can exercise
 * `put`/`get`/`head` without a real network call.
 */

import type { StorageBackend } from "./backend.js";
import { assertDigestMatches, parseDigest } from "../digest.js";

export interface S3SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/** Produces a signed request for one S3 operation. Implementations wrap
 *  SigV4 (or the deployment's own broker) — never a bare access key here. */
export interface S3RequestSigner {
  sign(method: "PUT" | "GET" | "HEAD", key: string, opts?: { presignTtlSeconds?: number }): Promise<S3SignedRequest>;
}

export interface S3BackendOptions {
  bucket: string;
  signer: S3RequestSigner;
  fetchImpl?: typeof fetch;
}

function objectKey(digest: string): string {
  const hex = parseDigest(digest);
  return `sha256/${hex.slice(0, 2)}/${hex.slice(2, 4)}/${hex}.bin`;
}

export class S3StorageBackend implements StorageBackend {
  readonly kind = "s3" as const;
  private readonly bucket: string;
  private readonly signer: S3RequestSigner;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: S3BackendOptions) {
    this.bucket = opts.bucket;
    this.signer = opts.signer;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async put(digest: string, body: Uint8Array, mediaType: string): Promise<void> {
    assertDigestMatches(digest, body);
    const existing = await this.head(digest);
    if (existing !== null && existing.size === body.byteLength) {
      return; // idempotent no-op
    }
    const key = objectKey(digest);
    const req = await this.signer.sign("PUT", key);
    const res = await this.fetchImpl(req.url, {
      method: "PUT",
      headers: { ...req.headers, "content-type": mediaType },
      body,
    });
    if (!res.ok) {
      throw new Error(`s3 put failed for bucket ${this.bucket} key ${key}: HTTP ${res.status}`);
    }
  }

  async get(digest: string): Promise<Uint8Array> {
    const key = objectKey(digest);
    const req = await this.signer.sign("GET", key);
    const res = await this.fetchImpl(req.url, { method: "GET", headers: req.headers });
    if (!res.ok) {
      throw new Error(`s3 get failed for bucket ${this.bucket} key ${key}: HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async head(digest: string): Promise<{ size: number; mediaType: string } | null> {
    const key = objectKey(digest);
    const req = await this.signer.sign("HEAD", key);
    const res = await this.fetchImpl(req.url, { method: "HEAD", headers: req.headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`s3 head failed for bucket ${this.bucket} key ${key}: HTTP ${res.status}`);
    }
    const size = Number(res.headers.get("content-length") ?? "0");
    const mediaType = res.headers.get("content-type") ?? "application/octet-stream";
    return { size, mediaType };
  }

  async presignGet(digest: string, ttlSeconds: number): Promise<string> {
    const key = objectKey(digest);
    const req = await this.signer.sign("GET", key, { presignTtlSeconds: ttlSeconds });
    return req.url;
  }
}
