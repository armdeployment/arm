/**
 * DiscoverySource adapter interface (guide 01 §6.2).
 *
 * Every adapter implementation must uphold the four non-negotiable rules
 * (guide 01 §6.2), each with a test in `test/sources.test.ts`:
 *   1. A synced candidate lands as `discovery_candidate`, never a component.
 *   2. Promotion (separate module, `promote.ts`) creates the component with
 *      `review_status = 'draft'` / `source_kind = 'imported'`.
 *   3. Every imported version pins an exact upstream version + digest —
 *      never a tag, branch, or `latest`.
 *   4. Sync never executes fetched code and never follows redirects off the
 *      source host.
 *
 * Rule 4 is enforced structurally here via `fetchJsonSameOrigin` — every
 * adapter routes its network call through it rather than calling `fetch`
 * directly, and it only ever calls `JSON.parse` on the response body (never
 * `eval`/`Function`/dynamic `import()` of fetched content).
 */

import type { ComponentKind } from "@arm/proto";

export interface DiscoveredCandidate {
  externalRef: string;
  proposedKind: ComponentKind;
  name: string;
  description: string;
  rawManifest: Record<string, unknown>;
}

export interface DiscoverySourceRef {
  endpoint: string;
  authRef: string | null;
}

export interface DiscoverySourceAdapter {
  kind: "mcp_registry" | "git" | "http_index";
  fetchCandidates(source: DiscoverySourceRef, deps?: { fetchImpl?: typeof fetch }): Promise<DiscoveredCandidate[]>;
}

/**
 * Fetch JSON from `url`, refusing to follow any redirect that lands on a
 * different host than `url` itself (rule 4). Parses the body with
 * `JSON.parse` only — never executes response content as code.
 */
export async function fetchJsonSameOrigin(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const sourceHost = new URL(url).host;
  const res = await fetchImpl(url, { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `discovery sync refused a redirect from ${url} (status ${res.status}) — sync never follows redirects off the source host`,
    );
  }
  if (res.type === "opaqueredirect") {
    throw new Error(`discovery sync refused an opaque redirect from ${url}`);
  }
  const finalUrl = (res as { url?: string }).url;
  if (finalUrl) {
    const finalHost = new URL(finalUrl).host;
    if (finalHost !== sourceHost) {
      throw new Error(`discovery sync refused a cross-host response: ${url} -> ${finalUrl}`);
    }
  }
  if (!res.ok) {
    throw new Error(`discovery sync: ${url} responded HTTP ${res.status}`);
  }
  const text = await res.text();
  return JSON.parse(text) as unknown; // never eval()/Function() — data only
}
