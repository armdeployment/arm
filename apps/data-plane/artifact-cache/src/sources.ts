/**
 * Blob sources: tenant backend, then (for first-party artifacts) the
 * upstream control-plane CDN (guide 01 §5).
 *
 * The control plane's CDN only ever serves `first_party` artifacts — that
 * is enforced control-plane-side (the source of truth for residency,
 * `blob-residency` guardrail), not re-derived here; this app simply tries
 * the tenant backend first and falls back to the CDN on a miss, matching
 * the fetch order the guide specifies.
 */

export interface FetchedBlob {
  body: Uint8Array;
  mediaType: string;
}

export interface ArtifactSource {
  name: string;
  fetchBlob(digest: string): Promise<FetchedBlob | null>;
}

export interface HttpSourceOptions {
  /** Base URL of the source, e.g. "http://tenant-blob-store.internal". */
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/** A generic HTTP-backed source: `GET {baseUrl}/{digest}`. Used for both the
 *  tenant backend and the control-plane CDN — same wire shape, different
 *  base URL. */
export function httpSource(name: string, opts: HttpSourceOptions): ArtifactSource {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name,
    async fetchBlob(digest: string): Promise<FetchedBlob | null> {
      const res = await fetchImpl(`${opts.baseUrl}/${encodeURIComponent(digest)}`, {
        redirect: "manual",
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`${name}: fetching ${digest} failed with HTTP ${res.status}`);
      }
      const body = new Uint8Array(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "application/octet-stream";
      return { body, mediaType };
    },
  };
}

/** Try each source in order; the first non-null hit wins. Never re-signs or
 *  rewrites the bytes it gets back — callers verify sha256 before caching. */
export async function fetchFromSources(
  digest: string,
  sources: readonly ArtifactSource[],
): Promise<FetchedBlob | null> {
  for (const source of sources) {
    const found = await source.fetchBlob(digest);
    if (found !== null) return found;
  }
  return null;
}
