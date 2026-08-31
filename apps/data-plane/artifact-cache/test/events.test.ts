import { describe, it, expect, beforeEach } from "vitest";
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
