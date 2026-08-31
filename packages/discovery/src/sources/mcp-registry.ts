/**
 * Public MCP registry adapter (guide 01 §6.2).
 *
 * Expects `endpoint` to serve a JSON array of MCP server listings, the shape
 * the public MCP registry index publishes: `{ name, description, id/slug }`.
 * Every listing becomes a `proposed_kind: "mcp"` candidate — never a
 * component (rule 1); promotion is a separate, later step (`promote.ts`).
 */

import type { DiscoveredCandidate, DiscoverySourceAdapter, DiscoverySourceRef } from "./types.js";
import { fetchJsonSameOrigin } from "./types.js";

interface McpRegistryListing {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  [key: string]: unknown;
}

export const mcpRegistryAdapter: DiscoverySourceAdapter = {
  kind: "mcp_registry",
  async fetchCandidates(source: DiscoverySourceRef, deps): Promise<DiscoveredCandidate[]> {
    const body = await fetchJsonSameOrigin(source.endpoint, deps?.fetchImpl);
    if (!Array.isArray(body)) {
      throw new Error(`mcp-registry adapter: expected a JSON array from ${source.endpoint}`);
    }
    return (body as McpRegistryListing[]).map((listing) => {
      const externalRef = listing.id ?? listing.slug ?? listing.name;
      if (!externalRef) {
        throw new Error(
          `mcp-registry adapter: listing has no id/slug/name to key on: ${JSON.stringify(listing)}`,
        );
      }
      return {
        externalRef: String(externalRef),
        proposedKind: "mcp",
        name: listing.name,
        description: listing.description ?? "",
        rawManifest: listing as Record<string, unknown>,
      };
    });
  },
};
