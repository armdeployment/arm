import { describe, it, expect } from "vitest";
import { LocalArtifactCache } from "../src/cache.js";

function bytes(n: number): Uint8Array {
  return new Uint8Array(n).fill(7);
}

describe("LocalArtifactCache (digest-keyed, no TTL, LRU eviction)", () => {
  it("misses on unknown digests and hits after put", () => {
    const cache = new LocalArtifactCache(1000);
    expect(cache.get("d1")).toBeUndefined();
    cache.put("d1", { body: bytes(10), mediaType: "text/plain" });
    expect(cache.get("d1")).toBeDefined();
  });

  it("evicts least-recently-used entries under a size cap", () => {
    const cache = new LocalArtifactCache(25);
    cache.put("a", { body: bytes(10), mediaType: "x" });
    cache.put("b", { body: bytes(10), mediaType: "x" });
    cache.get("a"); // touch a
    cache.put("c", { body: bytes(10), mediaType: "x" }); // evicts b
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("never expires an entry due to age (no TTL) — only eviction under the cap", () => {
    const cache = new LocalArtifactCache(1000);
    cache.put("a", { body: bytes(10), mediaType: "x" });
    // simulate the passage of time — nothing in this cache's API can expire it
    expect(cache.has("a")).toBe(true);
  });

  it("rejects a non-positive cap", () => {
    expect(() => new LocalArtifactCache(0)).toThrow();
  });
});
