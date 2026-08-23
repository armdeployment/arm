/**
 * Generic JSON index adapter (guide 01 §6.2).
 *
 * Expects `endpoint` to serve `{ components: [{ external_ref, kind, name,
 * description, manifest }] }` — the simplest possible marketplace index
 * shape, for sources that don't fit the MCP-registry or git conventions.
 */

import type { DiscoveredCandidate, DiscoverySourceAdapter, DiscoverySourceRef } from "./types.js";
import { fetchJsonSameOrigin } from "./types.js";
import { componentKindSchema } from "@arm/proto";

interface HttpIndexEntry {
  external_ref: string;
  kind: string;
  name: string;
  description?: string;
  manifest?: Record<string, unknown>;
}

interface HttpIndexBody {
  components: HttpIndexEntry[];
}

export const httpIndexAdapter: DiscoverySourceAdapter = {
  kind: "http_index",
  async fetchCandidates(source: DiscoverySourceRef, deps): Promise<DiscoveredCandidate[]> {
    const body = (await fetchJsonSameOrigin(source.endpoint, deps?.fetchImpl)) as HttpIndexBody;
    if (!body || !Array.isArray(body.components)) {
      throw new Error(`http-index adapter: expected { components: [...] } from ${source.endpoint}`);
    }
    return body.components.map((entry) => {
      const kindParse = componentKindSchema.safeParse(entry.kind);
      if (!kindParse.success) {
        throw new Error(`http-index adapter: entry "${entry.external_ref}" has invalid kind "${entry.kind}"`);
      }
      return {
        externalRef: entry.external_ref,
        proposedKind: kindParse.data,
        name: entry.name,
        description: entry.description ?? "",
        rawManifest: entry.manifest ?? {},
      };
    });
  },
};
