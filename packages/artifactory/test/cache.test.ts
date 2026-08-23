import { describe, it, expect } from "vitest";
import { DigestCache } from "../src/cache.js";

function bytes(n: number): Uint8Array {
  return new Uint8Array(n).fill(1);
}

describe("DigestCache (pull-through, digest-keyed, no TTL, LRU eviction)", () => {
  it("misses on an unknown digest and hits after put", () => {
    const cache = new DigestCache({ maxBytes: 100 });
    expect(cache.peek("d1")).toBeUndefined();
    cache.put("d1", { body: bytes(10), mediaType: "text/plain" });
    expect(cache.peek("d1")).toBeDefined();
  });

  it("getOrFetch calls the fetcher only on a miss", async () => {
    const cache = new DigestCache({ maxBytes: 1000 });
    let calls = 0;
    const fetcher = async (digest: string) => {
      calls++;
      return { body: bytes(10), mediaType: "application/octet-stream" };
    };
    await cache.getOrFetch("d1", fetcher);
    await cache.getOrFetch("d1", fetcher);
    await cache.getOrFetch("d1", fetcher);
    expect(calls).toBe(1); // digest-keyed immutability — no TTL, never re-fetched
  });

  it("evicts least-recently-used entries when the size cap is exceeded", () => {
    const cache = new DigestCache({ maxBytes: 25 });
    cache.put("a", { body: bytes(10), mediaType: "x" });
    cache.put("b", { body: bytes(10), mediaType: "x" });
    // touch "a" so "b" becomes the least-recently-used
    cache.peek("a");
    cache.put("c", { body: bytes(10), mediaType: "x" }); // forces eviction of "b"
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("bytesUsed tracks the sum of cached entry sizes", () => {
    const cache = new DigestCache({ maxBytes: 1000 });
    cache.put("a", { body: bytes(10), mediaType: "x" });
    cache.put("b", { body: bytes(20), mediaType: "x" });
    expect(cache.bytesUsed()).toBe(30);
  });

  it("an entry larger than the whole cap is not cached, but no error is thrown", () => {
    const cache = new DigestCache({ maxBytes: 5 });
    expect(() => cache.put("big", { body: bytes(100), mediaType: "x" })).not.toThrow();
    expect(cache.has("big")).toBe(false);
  });

  it("re-putting the same digest updates size accounting correctly (no double-count)", () => {
    const cache = new DigestCache({ maxBytes: 1000 });
    cache.put("a", { body: bytes(10), mediaType: "x" });
    cache.put("a", { body: bytes(20), mediaType: "x" });
    expect(cache.bytesUsed()).toBe(20);
    expect(cache.size()).toBe(1);
  });

  it("rejects a non-positive maxBytes", () => {
    expect(() => new DigestCache({ maxBytes: 0 })).toThrow();
    expect(() => new DigestCache({ maxBytes: -1 })).toThrow();
  });
});
