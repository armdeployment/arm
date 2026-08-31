/**
 * StorageBackend contract test suite — run against EVERY backend so
 * behavior stays identical regardless of which one a tenant configures
 * (guide 01 §2.1, acceptance criteria "Both storage backends pass the same
 * contract test suite").
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StorageBackend } from "../src/storage/backend.js";
import { FsStorageBackend } from "../src/storage/fs.js";
import { S3StorageBackend, type S3RequestSigner, type S3SignedRequest } from "../src/storage/s3.js";
import { OciStorageBackend } from "../src/storage/oci.js";
import { NotImplementedError } from "../src/storage/backend.js";
import { digestOf } from "../src/digest.js";

/** In-memory fake of an S3-compatible endpoint, driven through `fetchImpl`. */
function makeFakeS3(): { fetchImpl: typeof fetch; signer: S3RequestSigner } {
  const store = new Map<string, { body: Uint8Array; mediaType: string }>();
  const signer: S3RequestSigner = {
    async sign(method, key, opts): Promise<S3SignedRequest> {
      const url = `https://fake-s3.example.com/bucket/${key}?method=${method}&ttl=${opts?.presignTtlSeconds ?? 0}`;
      return { url, headers: { "x-fake-sig": "ok" } };
    },
  };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const key = url.pathname.replace(/^\/bucket\//, "");
    const method = url.searchParams.get("method");
    if (method === "PUT") {
      const body = init?.body as Uint8Array;
      const mediaType =
        (init?.headers as Record<string, string>)["content-type"] ?? "application/octet-stream";
      store.set(key, { body: new Uint8Array(body), mediaType });
      return new Response(null, { status: 200 });
    }
    if (method === "HEAD") {
      const entry = store.get(key);
      if (!entry) return new Response(null, { status: 404 });
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": String(entry.body.byteLength),
          "content-type": entry.mediaType,
        },
      });
    }
    if (method === "GET") {
      const entry = store.get(key);
      if (!entry) return new Response(null, { status: 404 });
      return new Response(entry.body, { status: 200 });
    }
    return new Response(null, { status: 400 });
  }) as unknown as typeof fetch;
  return { fetchImpl, signer };
}

interface BackendUnderTest {
  name: string;
  make: () => Promise<StorageBackend>;
  cleanup?: () => Promise<void>;
}

const tmpDirs: string[] = [];

const backends: BackendUnderTest[] = [
  {
    name: "fs",
    make: async () => {
      const dir = await mkdtemp(join(tmpdir(), "arm-artifactory-fs-"));
      tmpDirs.push(dir);
      return new FsStorageBackend({ baseDir: dir });
    },
  },
  {
    name: "s3",
    make: async () => {
      const { fetchImpl, signer } = makeFakeS3();
      return new S3StorageBackend({ bucket: "arm-artifacts", signer, fetchImpl });
    },
  },
];

for (const { name, make } of backends) {
  describe(`StorageBackend contract: ${name}`, () => {
    let backend: StorageBackend;
    const body = new TextEncoder().encode("hello artifact bytes");
    const digest = digestOf(body);

    beforeEach(async () => {
      backend = await make();
    });

    it("head() returns null for content that was never put", async () => {
      expect(await backend.head(digest)).toBeNull();
    });

    it("put() then get() round-trips the exact bytes", async () => {
      await backend.put(digest, body, "text/plain");
      const fetched = await backend.get(digest);
      expect(new TextDecoder().decode(fetched)).toBe("hello artifact bytes");
    });

    it("put() then head() reports the correct size + mediaType", async () => {
      await backend.put(digest, body, "text/plain");
      const meta = await backend.head(digest);
      expect(meta).toEqual({ size: body.byteLength, mediaType: "text/plain" });
    });

    it("put() is VERIFYING: throws when body does not match the declared digest", async () => {
      const wrongDigest = `sha256:${"0".repeat(64)}`;
      await expect(backend.put(wrongDigest, body, "text/plain")).rejects.toThrow(/digest mismatch/);
    });

    it("put() is IDEMPOTENT: putting the same digest+size twice does not throw", async () => {
      await backend.put(digest, body, "text/plain");
      await expect(backend.put(digest, body, "text/plain")).resolves.not.toThrow();
      const meta = await backend.head(digest);
      expect(meta?.size).toBe(body.byteLength);
    });

    it("presignGet() returns a URL string", async () => {
      await backend.put(digest, body, "text/plain");
      const url = await backend.presignGet(digest, 60);
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    });

    it("kind matches the expected backend name", () => {
      expect(backend.kind).toBe(name);
    });
  });
}

describe("StorageBackend contract: oci (stub — throws NotImplementedError)", () => {
  const backend = new OciStorageBackend();
  const body = new TextEncoder().encode("x");
  const digest = digestOf(body);

  it("put() throws NotImplementedError", async () => {
    await expect(backend.put(digest, body, "text/plain")).rejects.toBeInstanceOf(
      NotImplementedError,
    );
  });
  it("get() throws NotImplementedError", async () => {
    await expect(backend.get(digest)).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("head() throws NotImplementedError", async () => {
    await expect(backend.head(digest)).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("presignGet() throws NotImplementedError", async () => {
    await expect(backend.presignGet(digest, 60)).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("kind is 'oci'", () => {
    expect(backend.kind).toBe("oci");
  });
});

describe("FsStorageBackend presigned URL signature", () => {
  it("verifyPresignedSignature accepts a URL it just signed and rejects a tampered one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "arm-artifactory-fs-sig-"));
    tmpDirs.push(dir);
    const backend = new FsStorageBackend({ baseDir: dir });
    const body = new TextEncoder().encode("sig test");
    const digest = digestOf(body);
    await backend.put(digest, body, "text/plain");
    const url = await backend.presignGet(digest, 60);
    const parsed = new URL(url);
    const exp = Number(parsed.searchParams.get("exp"));
    const sig = parsed.searchParams.get("sig")!;
    expect(backend.verifyPresignedSignature(digest, exp, sig)).toBe(true);
    expect(backend.verifyPresignedSignature(digest, exp, `${sig.slice(0, -2)}00`)).toBe(false);
    // Expired: nowSeconds far past exp
    expect(backend.verifyPresignedSignature(digest, exp, sig, exp + 3600)).toBe(false);
  });
});

afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true }).catch(() => {})));
});
