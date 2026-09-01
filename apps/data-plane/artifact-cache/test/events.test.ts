import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildComponentPullEvent,
  recordPull,
  getPullEventBuffer,
  clearPullEventBuffer,
} from "../src/events.js";

describe("component_pull_event emission (metadata only)", () => {
  beforeEach(() => clearPullEventBuffer());

  it("builds a valid componentPullEventSchema row", () => {
    const event = buildComponentPullEvent({
      tenantId: "tn-1",
      componentId: "c1",
      version: "1.0.0",
      blobDigest: `sha256:${"a".repeat(64)}`,
      bytes: 1024,
      cacheHit: true,
    });
    expect(event.cache_hit).toBe(1);
    expect(event.bytes).toBe(1024);
    expect(event.tenant_id).toBe("tn-1");
  });

  it("carries NO content fields — metadata only (Invariant §11.1)", () => {
    const event = buildComponentPullEvent({
      tenantId: "tn-1",
      componentId: "c1",
      version: "1.0.0",
      blobDigest: `sha256:${"a".repeat(64)}`,
      bytes: 10,
      cacheHit: false,
    });
    const fields = Object.keys(event);
    for (const f of fields) {
      expect(f).not.toMatch(/prompt|completion|content|body/i);
    }
  });

  it("recordPull appends to the in-memory buffer", () => {
    expect(getPullEventBuffer()).toHaveLength(0);
    recordPull({
      tenantId: "tn-1",
      componentId: "c1",
      version: "1.0.0",
      blobDigest: `sha256:${"a".repeat(64)}`,
      bytes: 5,
      cacheHit: false,
    });
    expect(getPullEventBuffer()).toHaveLength(1);
  });

  it("cacheHit maps to 0/1 correctly", () => {
    const hit = buildComponentPullEvent({
      tenantId: "t",
      componentId: "c",
      version: "1.0.0",
      blobDigest: `sha256:${"a".repeat(64)}`,
      bytes: 1,
      cacheHit: true,
    });
    const miss = buildComponentPullEvent({
      tenantId: "t",
      componentId: "c",
      version: "1.0.0",
      blobDigest: `sha256:${"a".repeat(64)}`,
      bytes: 1,
      cacheHit: false,
    });
    expect(hit.cache_hit).toBe(1);
    expect(miss.cache_hit).toBe(0);
  });
});

describe("flushing pull events to the control plane", () => {
  // These used to buffer in-process and go nowhere, so the adoption panels had
  // no pull data and cache-hit accounting was invisible.
  const input = {
    tenantId: "tn_01",
    componentId: "cmp_01",
    version: "1.0.0",
    blobDigest: "sha256:abc",
    bytes: 1024,
    cacheHit: true,
  };

  beforeEach(async () => {
    const { clearPullEventBuffer } = await import("../src/events.js");
    clearPullEventBuffer();
  });

  it("sends the batch and only then drops the events", async () => {
    const { recordPull, flushPullEvents, getPullFlushHealth } = await import("../src/events.js");
    recordPull(input);
    recordPull({ ...input, cacheHit: false });

    const sent: unknown[] = [];
    const send = vi.fn(async (batch: unknown) => void sent.push(batch));
    const r = await flushPullEvents(send, "https://control.example.com");

    expect(r).toEqual({ flushed: 2, remaining: 0 });
    expect((sent[0] as { events: unknown[] }).events).toHaveLength(2);
    expect(getPullFlushHealth().buffered).toBe(0);
  });

  it("KEEPS every event when the control plane is unreachable", async () => {
    const { recordPull, flushPullEvents } = await import("../src/events.js");
    recordPull(input);
    const r = await flushPullEvents(
      vi.fn(async () => {
        throw new Error("ingest returned 503");
      }),
      "https://control.example.com",
    );
    expect(r.flushed).toBe(0);
    expect(r.remaining).toBe(1);
    expect(r.error).toContain("503");
  });

  it("does not drop events when no control plane is configured", async () => {
    const { recordPull, flushPullEvents } = await import("../src/events.js");
    recordPull(input);
    const r = await flushPullEvents(vi.fn(), undefined);
    expect(r.remaining).toBe(1);
    expect(r.error).toContain("ARM_CONTROL_PLANE_URL");
  });

  it("reports that it cannot drain, rather than looking healthy", async () => {
    const { recordPull, getPullFlushHealth } = await import("../src/events.js");
    recordPull(input);
    expect(getPullFlushHealth().drainConfigured).toBe(false);
  });
});
