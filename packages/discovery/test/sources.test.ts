import { describe, it, expect } from "vitest";
import { fetchJsonSameOrigin } from "../src/sources/types.js";
import { mcpRegistryAdapter } from "../src/sources/mcp-registry.js";
import { gitOrgScannerAdapter } from "../src/sources/git.js";
import { httpIndexAdapter } from "../src/sources/http-index.js";

function jsonResponse(body: unknown, init?: { status?: number; url?: string }): Response {
  const res = new Response(JSON.stringify(body), { status: init?.status ?? 200 });
  if (init?.url) Object.defineProperty(res, "url", { value: init.url });
  return res;
}

function fakeFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request) =>
    handler(typeof input === "string" ? input : input.toString())) as unknown as typeof fetch;
}

describe("fetchJsonSameOrigin (rule 4: no redirects off source host, no code execution)", () => {
  it("parses JSON with JSON.parse only (never eval)", async () => {
    const fetchImpl = fakeFetch(() => jsonResponse({ a: 1 }));
    const result = await fetchJsonSameOrigin("https://registry.example.com/index.json", fetchImpl);
    expect(result).toEqual({ a: 1 });
  });

  it("refuses a 3xx redirect response", async () => {
    const fetchImpl = fakeFetch(() => new Response(null, { status: 302 }));
    await expect(
      fetchJsonSameOrigin("https://registry.example.com/index.json", fetchImpl),
    ).rejects.toThrow(/redirect/);
  });

  it("refuses a response whose final URL lands on a different host", async () => {
    const fetchImpl = fakeFetch(() =>
      jsonResponse({ a: 1 }, { url: "https://evil.example.com/hijacked.json" }),
    );
    await expect(
      fetchJsonSameOrigin("https://registry.example.com/index.json", fetchImpl),
    ).rejects.toThrow(/cross-host/);
  });

  it("throws on a non-2xx, non-redirect response", async () => {
    const fetchImpl = fakeFetch(() => new Response(null, { status: 500 }));
    await expect(
      fetchJsonSameOrigin("https://registry.example.com/index.json", fetchImpl),
    ).rejects.toThrow(/HTTP 500/);
  });

  it("never executes fetched content as code (a JS payload stays inert JSON-parse failure, not eval'd)", async () => {
    const fetchImpl = fakeFetch(() => new Response("globalThis.PWNED = true;", { status: 200 }));
    await expect(
      fetchJsonSameOrigin("https://registry.example.com/index.json", fetchImpl),
    ).rejects.toThrow();
    expect((globalThis as Record<string, unknown>).PWNED).toBeUndefined();
  });
});

describe("mcpRegistryAdapter", () => {
  it("maps a JSON array of listings into mcp candidates, never a component", async () => {
    const fetchImpl = fakeFetch(() =>
      jsonResponse([
        { id: "jira-mcp", name: "Jira MCP", description: "Issue tracking" },
        { slug: "github-mcp", name: "GitHub MCP" },
      ]),
    );
    const candidates = await mcpRegistryAdapter.fetchCandidates(
      { endpoint: "https://registry.example.com/index.json", authRef: null },
      { fetchImpl },
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      externalRef: "jira-mcp",
      proposedKind: "mcp",
      name: "Jira MCP",
      description: "Issue tracking",
      rawManifest: { id: "jira-mcp", name: "Jira MCP", description: "Issue tracking" },
    });
    // structural proof of rule 1: nothing here has a "review_status" or
    // "id" (component primary key) field — this is a candidate shape only.
    for (const c of candidates) {
      expect(c).not.toHaveProperty("review_status");
      expect(c).not.toHaveProperty("id");
    }
  });

  it("throws when the response isn't a JSON array", async () => {
    const fetchImpl = fakeFetch(() => jsonResponse({ not: "an array" }));
    await expect(
      mcpRegistryAdapter.fetchCandidates(
        { endpoint: "https://registry.example.com/index.json", authRef: null },
        { fetchImpl },
      ),
    ).rejects.toThrow(/expected a JSON array/);
  });
});

describe("gitOrgScannerAdapter", () => {
  it("only picks up repos carrying the arm-component topic", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.includes("repos.json")) {
        return jsonResponse([
          {
            name: "opted-in-repo",
            topics: ["arm-component"],
            manifest_url: "https://git.example.com/opted-in-repo/arm-component.json",
          },
          { name: "unrelated-repo", topics: ["other-topic"] },
        ]);
      }
      return jsonResponse({ kind: "skill", name: "Opted In", description: "A skill" });
    });
    const candidates = await gitOrgScannerAdapter.fetchCandidates(
      { endpoint: "https://git.example.com/repos.json", authRef: null },
      { fetchImpl },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.externalRef).toBe("opted-in-repo");
    expect(candidates[0]!.proposedKind).toBe("skill");
  });

  it("skips a repo with the opt-in topic but no manifest_url yet", async () => {
    const fetchImpl = fakeFetch(() =>
      jsonResponse([{ name: "no-manifest-yet", topics: ["arm-component"] }]),
    );
    const candidates = await gitOrgScannerAdapter.fetchCandidates(
      { endpoint: "https://git.example.com/repos.json", authRef: null },
      { fetchImpl },
    );
    expect(candidates).toHaveLength(0);
  });

  it("falls back to 'plugin' kind when the manifest's kind is invalid/missing", async () => {
    const fetchImpl = fakeFetch((url) =>
      url.includes("repos.json")
        ? jsonResponse([
            {
              name: "r",
              topics: ["arm-component"],
              manifest_url: "https://git.example.com/r/manifest.json",
            },
          ])
        : jsonResponse({ name: "R" }),
    );
    const candidates = await gitOrgScannerAdapter.fetchCandidates(
      { endpoint: "https://git.example.com/repos.json", authRef: null },
      { fetchImpl },
    );
    expect(candidates[0]!.proposedKind).toBe("plugin");
  });
});

describe("httpIndexAdapter", () => {
  it("maps a generic { components: [...] } index", async () => {
    const fetchImpl = fakeFetch(() =>
      jsonResponse({
        components: [
          {
            external_ref: "ext-1",
            kind: "http_api",
            name: "Ext API",
            description: "desc",
            manifest: { x: 1 },
          },
        ],
      }),
    );
    const candidates = await httpIndexAdapter.fetchCandidates(
      { endpoint: "https://marketplace.example.com/index.json", authRef: null },
      { fetchImpl },
    );
    expect(candidates).toEqual([
      {
        externalRef: "ext-1",
        proposedKind: "http_api",
        name: "Ext API",
        description: "desc",
        rawManifest: { x: 1 },
      },
    ]);
  });

  it("throws on an invalid component kind", async () => {
    const fetchImpl = fakeFetch(() =>
      jsonResponse({ components: [{ external_ref: "ext-1", kind: "not-a-real-kind", name: "X" }] }),
    );
    await expect(
      httpIndexAdapter.fetchCandidates(
        { endpoint: "https://marketplace.example.com/index.json", authRef: null },
        { fetchImpl },
      ),
    ).rejects.toThrow(/invalid kind/);
  });

  it("throws when the response has no components array", async () => {
    const fetchImpl = fakeFetch(() => jsonResponse({ nope: true }));
    await expect(
      httpIndexAdapter.fetchCandidates(
        { endpoint: "https://marketplace.example.com/index.json", authRef: null },
        { fetchImpl },
      ),
    ).rejects.toThrow(/expected/);
  });
});
