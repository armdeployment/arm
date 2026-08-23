import { describe, it, expect } from "vitest";
import { httpSource, fetchFromSources, type ArtifactSource } from "../src/sources.js";

function fakeFetch(byDigest: Record<string, { status: number; body?: string }>): typeof fetch {
  return (async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const digest = decodeURIComponent(url.split("/").pop()!);
    const entry = byDigest[digest];
    if (!entry) return new Response(null, { status: 404 });
    return new Response(entry.body ?? "", { status: entry.status, headers: { "content-type": "text/plain" } });
  }) as unknown as typeof fetch;
}

describe("httpSource", () => {
  it("returns null (not throw) on a 404", async () => {
    const source = httpSource("test", { baseUrl: "http://x", fetchImpl: fakeFetch({}) });
    expect(await source.fetchBlob("sha256:missing")).toBeNull();
  });

  it("returns bytes + mediaType on a 200", async () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const source = httpSource("test", { baseUrl: "http://x", fetchImpl: fakeFetch({ [digest]: { status: 200, body: "hello" } }) });
    const result = await source.fetchBlob(digest);
    expect(result?.mediaType).toBe("text/plain");
    expect(new TextDecoder().decode(result!.body)).toBe("hello");
  });

  it("throws on a non-404 error status", async () => {
    const digest = `sha256:${"b".repeat(64)}`;
    const source = httpSource("test", { baseUrl: "http://x", fetchImpl: fakeFetch({ [digest]: { status: 500 } }) });
    await expect(source.fetchBlob(digest)).rejects.toThrow(/HTTP 500/);
  });
});

describe("fetchFromSources (tenant backend -> control-plane CDN order)", () => {
  it("returns the first non-null hit", async () => {
    const tenant: ArtifactSource = { name: "tenant", fetchBlob: async () => null };
    const cdn: ArtifactSource = { name: "cdn", fetchBlob: async () => ({ body: new Uint8Array([1]), mediaType: "x" }) };
    const result = await fetchFromSources("sha256:x", [tenant, cdn]);
    expect(result).not.toBeNull();
  });

  it("prefers the tenant backend over the CDN when both have it", async () => {
    let cdnCalled = false;
    const tenant: ArtifactSource = { name: "tenant", fetchBlob: async () => ({ body: new Uint8Array([9]), mediaType: "tenant" }) };
    const cdn: ArtifactSource = {
      name: "cdn",
      fetchBlob: async () => {
        cdnCalled = true;
        return { body: new Uint8Array([1]), mediaType: "cdn" };
      },
    };
    const result = await fetchFromSources("sha256:x", [tenant, cdn]);
    expect(result?.mediaType).toBe("tenant");
    expect(cdnCalled).toBe(false);
  });

  it("returns null when no source has it", async () => {
    const a: ArtifactSource = { name: "a", fetchBlob: async () => null };
    const b: ArtifactSource = { name: "b", fetchBlob: async () => null };
    expect(await fetchFromSources("sha256:x", [a, b])).toBeNull();
  });
});
