import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/index.js";
import type { ArtifactSource } from "../src/sources.js";
import { digestOf } from "../src/digest.js";
import { clearPullEventBuffer } from "../src/events.js";

beforeEach(() => clearPullEventBuffer());

const BODY = new TextEncoder().encode("artifact bytes for the http layer");
const DIGEST = digestOf(BODY);

function sourcesWith(body: Uint8Array): ArtifactSource[] {
  return [
    {
      name: "fake",
      fetchBlob: async (digest) => (digest === DIGEST ? { body, mediaType: "text/plain" } : null),
    },
  ];
}

describe("GET /health", () => {
  it("reports ok", async () => {
    const app = createApp([]);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

describe("GET /artifacts/:digest", () => {
  it("400s on a malformed digest", async () => {
    const app = createApp([]);
    const res = await app.request("/artifacts/not-a-digest");
    expect(res.status).toBe(400);
  });

  it("404s when no source has the artifact", async () => {
    const app = createApp([{ name: "empty", fetchBlob: async () => null }]);
    const res = await app.request(`/artifacts/${DIGEST}`);
    expect(res.status).toBe(404);
  });

  it("serves the blob on a MISS, verifying the digest first, and marks x-arm-cache MISS", async () => {
    const app = createApp(sourcesWith(BODY));
    const res = await app.request(`/artifacts/${DIGEST}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-arm-cache")).toBe("MISS");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(buf)).toBe("artifact bytes for the http layer");
  });

  it("serves from the local cache on the second request, marked HIT, without calling the source again", async () => {
    let calls = 0;
    const source: ArtifactSource = {
      name: "counting",
      fetchBlob: async (digest) => {
        calls++;
        return digest === DIGEST ? { body: BODY, mediaType: "text/plain" } : null;
      },
    };
    const app = createApp([source]);
    await app.request(`/artifacts/${DIGEST}`);
    const res2 = await app.request(`/artifacts/${DIGEST}`);
    expect(res2.headers.get("x-arm-cache")).toBe("HIT");
    expect(calls).toBe(1); // source only ever hit once — the cache served the second request
  });

  it("502s and refuses to cache when the fetched bytes don't match the requested digest (never re-signs/rewrites)", async () => {
    const wrongBody = new TextEncoder().encode("this is NOT what the digest promises");
    const app = createApp(sourcesWith(wrongBody));
    const res = await app.request(`/artifacts/${DIGEST}`);
    expect(res.status).toBe(502);
    // A follow-up request must NOT be served from cache (nothing was cached).
    const res2 = await app.request(`/artifacts/${DIGEST}`);
    expect(res2.status).toBe(502);
  });

  it("emits a component_pull_event per served request, carrying metadata query params through", async () => {
    const app = createApp(sourcesWith(BODY));
    const res = await app.request(
      `/artifacts/${DIGEST}?tenant_id=tn-1&component_id=c1&version=1.0.0`,
    );
    expect(res.status).toBe(200);
    const eventsRes = await app.request("/events");
    const eventsBody = await eventsRes.json();
    expect(eventsBody.events).toBeGreaterThanOrEqual(1);
    const last = eventsBody.buffer.at(-1);
    expect(last.tenant_id).toBe("tn-1");
    expect(last.component_id).toBe("c1");
  });
});

describe("HEAD /artifacts/:digest", () => {
  it("returns headers with no body on a hit", async () => {
    const app = createApp(sourcesWith(BODY));
    const res = await app.request(`/artifacts/${DIGEST}`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(BODY.byteLength));
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBe(0);
  });

  it("404s when the artifact is unknown", async () => {
    const app = createApp([{ name: "empty", fetchBlob: async () => null }]);
    const res = await app.request(`/artifacts/${DIGEST}`, { method: "HEAD" });
    expect(res.status).toBe(404);
  });

  it("400s on a malformed digest", async () => {
    const app = createApp([]);
    const res = await app.request("/artifacts/nope", { method: "HEAD" });
    expect(res.status).toBe(400);
  });
});
