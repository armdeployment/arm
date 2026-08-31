/**
 * ARM Artifact Cache (docs/guides/01-library-artifactory.md §5).
 *
 * A small Node service in the tenant VPC:
 *   - `GET /artifacts/:digest` — serve a blob. Check local cache → tenant
 *     backend → (for first-party artifacts) the upstream control-plane CDN.
 *     Verify sha256 on every fill before caching. Never re-sign, never
 *     rewrite.
 *   - `HEAD /artifacts/:digest` — size + media type.
 *   - Emits `component_pull_event` (metadata only) per served request.
 *   - Digest-keyed cache with NO TTL (content-addressed artifacts are
 *     immutable) — eviction is LRU on a size cap.
 *
 * Imports `@arm/proto` and `@arm/config` ONLY (data-plane boundary rule,
 * `scripts/guardrails/src/checks/boundaries.ts`). It must NOT import
 * `@arm/artifactory` — the ~30 lines of digest verification are copied into
 * `digest.ts` instead of imported (see that file's header for why).
 */

import { Hono } from 'hono';
import { DIGEST_RE, verifyDigest } from './digest.js';
import { LocalArtifactCache } from './cache.js';
import { httpSource, fetchFromSources, type ArtifactSource } from './sources.js';
import { recordPull, getPullEventBuffer } from './events.js';

// ── Config (env-driven, mirrors the plugin-ingest/proxy pattern of local
//    process.env reads for app-specific settings not in the shared @arm/config
//    schema) ───────────────────────────────────────────────────────────────

const TENANT_BACKEND_URL =
  process.env['ARM_TENANT_BLOB_BACKEND_URL'] ?? 'http://localhost:8791/blobs';
const CONTROL_PLANE_CDN_URL =
  process.env['ARM_CONTROL_PLANE_CDN_URL'] ?? 'http://localhost:8792/cdn';
const CACHE_MAX_BYTES = Number(process.env['ARM_ARTIFACT_CACHE_MAX_BYTES'] ?? 100 * 1024 * 1024); // 100 MiB default

function defaultSources(): ArtifactSource[] {
  return [
    httpSource('tenant-backend', { baseUrl: TENANT_BACKEND_URL }),
    httpSource('control-plane-cdn', { baseUrl: CONTROL_PLANE_CDN_URL }),
  ];
}

// ── App ──────────────────────────────────────────────────────────────────

/** Each call builds an independent app + cache — this is what makes the
 *  service unit-testable without cross-test cache bleed (the exported
 *  `default app` below is the one long-lived instance a real process runs). */
export function createApp(sources: readonly ArtifactSource[] = defaultSources()) {
  const app = new Hono();
  const cache = new LocalArtifactCache(CACHE_MAX_BYTES);

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'artifact-cache',
      version: '0.0.0',
      cacheBytesUsed: cache.bytesUsed(),
    }),
  );

  /** Debug/observability surface — mirrors open-gateway's /metering. */
  app.get('/events', (c) =>
    c.json({ events: getPullEventBuffer().length, buffer: getPullEventBuffer().slice(-20) }),
  );

  async function resolveBlob(
    digest: string,
  ): Promise<{ body: Uint8Array; mediaType: string; cacheHit: boolean } | null> {
    const cached = cache.get(digest);
    if (cached) return { ...cached, cacheHit: true };

    const fetched = await fetchFromSources(digest, sources);
    if (fetched === null) return null;

    // Verify sha256 on every fill BEFORE caching. Never re-sign, never
    // rewrite: on mismatch we refuse the content outright rather than
    // "fixing" the digest or trusting the source.
    if (!verifyDigest(digest, fetched.body)) {
      throw new Error(
        `artifact-cache: digest verification FAILED for ${digest} — refusing to cache or serve`,
      );
    }
    cache.put(digest, fetched);
    return { ...fetched, cacheHit: false };
  }

  app.get('/artifacts/:digest', async (c) => {
    const digest = c.req.param('digest');
    if (!DIGEST_RE.test(digest)) {
      return c.json({ error: `malformed digest "${digest}" — expected sha256:<hex>` }, 400);
    }

    let resolved;
    try {
      resolved = await resolveBlob(digest);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
    if (resolved === null) {
      return c.json({ error: `artifact ${digest} not found in any configured source` }, 404);
    }

    recordPull({
      tenantId: c.req.query('tenant_id') ?? 'unknown',
      componentId: c.req.query('component_id') ?? 'unknown',
      version: c.req.query('version') ?? 'unknown',
      blobDigest: digest,
      bytes: resolved.body.byteLength,
      cacheHit: resolved.cacheHit,
      clientVersion: c.req.query('client_version') ?? '',
    });

    return new Response(resolved.body, {
      status: 200,
      headers: {
        'content-type': resolved.mediaType,
        'content-length': String(resolved.body.byteLength),
        'x-arm-cache': resolved.cacheHit ? 'HIT' : 'MISS',
      },
    });
  });

  app.on('HEAD', '/artifacts/:digest', async (c) => {
    const digest = c.req.param('digest');
    if (!DIGEST_RE.test(digest)) {
      return c.body(null, 400);
    }
    let resolved;
    try {
      resolved = await resolveBlob(digest);
    } catch {
      return c.body(null, 502);
    }
    if (resolved === null) {
      return c.body(null, 404);
    }
    return c.body(null, 200, {
      'content-type': resolved.mediaType,
      'content-length': String(resolved.body.byteLength),
      'x-arm-cache': resolved.cacheHit ? 'HIT' : 'MISS',
    });
  });

  return app;
}

const app = createApp();
export default app;

// ── Server start ───────────────────────────────────────────────────────
// Mirrors the proxy's zero-dependency `node:http` bridge rather than
// pulling in @hono/node-server, because the data-plane boundary rule
// (scripts/guardrails/src/checks/boundaries.ts) keeps this app's imports
// to @arm/proto and @arm/config.
//
// Two deliberate differences from the proxy's bridge: bodies move as
// Buffers, never strings — artifacts are arbitrary binary and `.text()`
// would corrupt anything that isn't valid UTF-8 — and the listener only
// runs when this module IS the process entrypoint, so importing
// `createApp` from a test never binds a port.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const PORT = Number.parseInt(process.env.ARTIFACT_CACHE_PORT ?? '8788', 10);

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      }

      // `exactOptionalPropertyTypes` is on, so `body` is attached only when
      // there is one rather than passed as an explicit undefined.
      const init: RequestInit = { method: req.method ?? 'GET', headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) init.body = Buffer.concat(chunks);
      }

      const resp = await app.fetch(new Request(url, init));
      res.writeHead(resp.status, Object.fromEntries(resp.headers));
      // HEAD carries the headers but must not carry bytes.
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(Buffer.from(await resp.arrayBuffer()));
    } catch (err) {
      console.error('[artifact-cache-error]', err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'artifact_cache_internal_error' }));
    }
  }).listen(PORT, () => console.log(`[artifact-cache] http://localhost:${PORT}`));
}
