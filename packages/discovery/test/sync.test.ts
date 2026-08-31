import { describe, it, expect } from "vitest";
import { syncSource, type ExistingCandidateRow } from "../src/sync.js";
import type { DiscoverySourceAdapter } from "../src/sources/types.js";

const SOURCE = { id: "src-1", endpoint: "https://registry.example.com/index.json", authRef: null };

function fakeAdapter(candidates: { externalRef: string; name: string }[]): DiscoverySourceAdapter {
  return {
    kind: "mcp_registry",
    fetchCandidates: async () =>
      candidates.map((c) => ({
        externalRef: c.externalRef,
        proposedKind: "mcp" as const,
        name: c.name,
        description: "",
        rawManifest: {},
      })),
  };
}

describe("syncSource (rule 1: lands as discovery_candidate, never a component)", () => {
  it("new external refs upsert with status 'new'", async () => {
    const adapter = fakeAdapter([{ externalRef: "jira-mcp", name: "Jira MCP" }]);
    const result = await syncSource(SOURCE, adapter, []);
    expect(result.newCount).toBe(1);
    expect(result.refreshedCount).toBe(0);
    expect(result.upserts[0]).toMatchObject({ id: null, externalRef: "jira-mcp", status: "new" });
  });

  it("existing external refs refresh content but KEEP their current triage status", async () => {
    const existing: ExistingCandidateRow[] = [
      { id: "cand-1", sourceId: "src-1", externalRef: "jira-mcp", status: "promoted" },
    ];
    const adapter = fakeAdapter([{ externalRef: "jira-mcp", name: "Jira MCP (renamed)" }]);
    const result = await syncSource(SOURCE, adapter, existing);
    expect(result.refreshedCount).toBe(1);
    expect(result.newCount).toBe(0);
    expect(result.upserts[0]).toMatchObject({
      id: "cand-1",
      name: "Jira MCP (renamed)",
      status: "promoted",
    });
  });

  it("only considers existing rows scoped to the same source", async () => {
    const existing: ExistingCandidateRow[] = [
      {
        id: "cand-other-source",
        sourceId: "src-OTHER",
        externalRef: "jira-mcp",
        status: "rejected",
      },
    ];
    const adapter = fakeAdapter([{ externalRef: "jira-mcp", name: "Jira MCP" }]);
    const result = await syncSource(SOURCE, adapter, existing);
    expect(result.newCount).toBe(1); // treated as new — the existing row belongs to a different source
  });

  it("every upsert is discovery_candidate-shaped, never a Component (structural: no review_status/id-as-component field)", async () => {
    const adapter = fakeAdapter([{ externalRef: "jira-mcp", name: "Jira MCP" }]);
    const result = await syncSource(SOURCE, adapter, []);
    for (const u of result.upserts) {
      expect(u).not.toHaveProperty("review_status");
      expect(u).not.toHaveProperty("source_kind");
      expect(u).toHaveProperty("status"); // discovery_candidate.status, not component.review_status
    }
  });

  it("passes fetchImpl through to the adapter (worker-controlled I/O, not baked into the module)", async () => {
    let calledWith: unknown;
    const adapter: DiscoverySourceAdapter = {
      kind: "mcp_registry",
      fetchCandidates: async (_source, deps) => {
        calledWith = deps?.fetchImpl;
        return [];
      },
    };
    const marker = (async () => new Response()) as unknown as typeof fetch;
    await syncSource(SOURCE, adapter, [], { fetchImpl: marker });
    expect(calledWith).toBe(marker);
  });
});
