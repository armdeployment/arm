/**
 * Internal git org scanner adapter (guide 01 §6.2).
 *
 * Convention: a repo opts in by carrying the `arm-component` topic (returned
 * inline by most git-forge "list org repos" APIs — GitHub/GitLab/Gitea all
 * expose `topics`) AND publishing a manifest file at its default branch root
 * named `arm-component.json`. `endpoint` must serve the ALREADY-SCOPED org
 * repo listing as JSON — this adapter does not know which git forge it is
 * talking to; it only expects the two conventions below.
 *
 * Listing shape expected per repo: `{ name, description, topics: string[],
 * manifest_url }` — `manifest_url` is a direct link to that repo's
 * `arm-component.json` (computed by whatever produces the listing; kept
 * out-of-band here so this adapter stays forge-agnostic and testable).
 */

import type { DiscoveredCandidate, DiscoverySourceAdapter, DiscoverySourceRef } from "./types.js";
import { fetchJsonSameOrigin } from "./types.js";
import { componentKindSchema } from "@arm/proto";

const OPT_IN_TOPIC = "arm-component";

interface GitRepoListing {
  name: string;
  description?: string;
  topics?: string[];
  manifest_url?: string;
  full_name?: string;
}

interface ArmComponentManifest {
  kind?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export const gitOrgScannerAdapter: DiscoverySourceAdapter = {
  kind: "git",
  async fetchCandidates(source: DiscoverySourceRef, deps): Promise<DiscoveredCandidate[]> {
    const body = await fetchJsonSameOrigin(source.endpoint, deps?.fetchImpl);
    if (!Array.isArray(body)) {
      throw new Error(`git adapter: expected a JSON array of repo listings from ${source.endpoint}`);
    }
    const optedIn = (body as GitRepoListing[]).filter((repo) => (repo.topics ?? []).includes(OPT_IN_TOPIC));

    const candidates: DiscoveredCandidate[] = [];
    for (const repo of optedIn) {
      if (!repo.manifest_url) {
        continue; // opted in via topic but no manifest published yet — not a candidate
      }
      const manifest = (await fetchJsonSameOrigin(repo.manifest_url, deps?.fetchImpl)) as ArmComponentManifest;
      const kindParse = componentKindSchema.safeParse(manifest.kind);
      candidates.push({
        externalRef: repo.full_name ?? repo.name,
        proposedKind: kindParse.success ? kindParse.data : "plugin",
        name: manifest.name ?? repo.name,
        description: manifest.description ?? repo.description ?? "",
        rawManifest: manifest,
      });
    }
    return candidates;
  },
};
