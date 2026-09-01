/**
 * Meter-agent buffer and flush.
 *
 * The previous version of this file asserted `flush clears buffer` — which
 * was true, and was the bug: `flushToControlPlane` emptied the buffer and
 * reported the count as `flushed` without sending anything anywhere. A test
 * that pins data loss as the expected behaviour is worse than no test, so the
 * cases below are written around the two properties that actually matter:
 * events survive a restart, and events are only dropped once the control
 * plane has accepted them.
 *
 * The buffer directory is redirected to a temp path before the module loads —
 * @arm/config reads process.env once at import time.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MeteringBatch, TokenUsageEvent } from "@arm/proto";

const BUFFER_DIR = mkdtempSync(join(tmpdir(), "arm-meter-"));
process.env.METER_AGENT_BUFFER_DIR = BUFFER_DIR;

type Mod = typeof import("../src/index.js");
let mod: Mod;

/** A wire-shaped event. snake_case, matching @arm/proto and ClickHouse. */
function event(over: Partial<TokenUsageEvent> = {}): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    tenant_id: "tn_01",
    sub_account_id: "sa_01",
    agent_id: "agt_01",
    priority_tier: "standard",
    model_id: "claude-sonnet-4-20250514",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.015,
    source: "proxy",
    ...over,
  };
}

beforeAll(async () => {
  mod = await import("../src/index.js");
});

beforeEach(() => {
  mod.__resetBuffer();
  if (existsSync(mod.BUFFER_SEGMENT_PATH)) rmSync(mod.BUFFER_SEGMENT_PATH);
});

afterAll(() => rmSync(BUFFER_DIR, { recursive: true, force: true }));

describe("ingest", () => {
  it("accepts a wire-shaped event", () => {
    expect(mod.ingestEvent(event())).toEqual({ accepted: true });
  });

  it("REJECTS the old camelCase shape — the schemas never matched", () => {
    // What the proxy and the meter-agent each used to speak. If this ever
    // passes again, two processes have drifted apart in silence.
    const legacy = {
      subAccountId: "sa_01",
      agentId: "agt_01",
      tenantId: "tn_01",
      priorityTier: "standard",
      model: "claude",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.015,
      source: "proxy",
      ts: new Date().toISOString(),
    };
    expect(mod.ingestEvent(legacy).accepted).toBe(false);
  });

  it("rejects junk", () => {
    expect(mod.ingestEvent({})).toEqual({
      accepted: false,
      reason: expect.stringContaining("validation_failed"),
    });
  });
});

describe("durability", () => {
  it("writes each accepted event to disk immediately", () => {
    mod.ingestEvent(event({ cost_usd: 0.5 }));
    mod.ingestEvent(event({ cost_usd: 0.25 }));
    const lines = readFileSync(mod.BUFFER_SEGMENT_PATH, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("RECOVERS buffered events after a restart", () => {
    // The property the in-memory buffer did not have: a proxy restart, a
    // rolling deploy or a crash used to lose every unflushed event.
    mod.ingestEvent(event({ cost_usd: 1.5 }));
    mod.ingestEvent(event({ cost_usd: 2.5 }));
    mod.__resetBuffer(); // simulates process death — disk is untouched
    expect(mod.getBufferHealth().eventCount).toBe(0);

    const { loaded, corrupt } = mod.loadBuffer();
    expect(loaded).toBe(2);
    expect(corrupt).toBe(0);
    expect(mod.getBufferHealth().eventCount).toBe(2);
  });

  it("skips a corrupt tail line rather than stranding everything before it", () => {
    mod.ingestEvent(event());
    writeFileSync(
      mod.BUFFER_SEGMENT_PATH,
      readFileSync(mod.BUFFER_SEGMENT_PATH, "utf8") + '{"half-writ',
    );
    mod.__resetBuffer();
    const { loaded, corrupt } = mod.loadBuffer();
    expect(loaded).toBe(1);
    expect(corrupt).toBe(1);
  });
});

describe("flush", () => {
  it("sends the batch and only then drops the events", async () => {
    mod.ingestEvent(event());
    mod.ingestEvent(event());
    const sent: MeteringBatch[] = [];
    const send = vi.fn(async (batch: MeteringBatch) => void sent.push(batch));

    const r = await mod.flushToControlPlane(send, "https://control.example.com");
    expect(r).toEqual({ flushed: 2, remaining: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent[0]!.events).toHaveLength(2);
    expect(sent[0]!.source_id).toBeTruthy();
    expect(mod.getBufferHealth().eventCount).toBe(0);
  });

  it("KEEPS every event when the control plane is unreachable", async () => {
    // The old implementation returned `{ flushed: 2 }` here having sent
    // nothing. At-least-once means a failed send changes nothing at all.
    mod.ingestEvent(event());
    mod.ingestEvent(event());
    const send = vi.fn(async () => {
      throw new Error("ingest returned 503: persist_failed");
    });

    const r = await mod.flushToControlPlane(send, "https://control.example.com");
    expect(r.flushed).toBe(0);
    expect(r.remaining).toBe(2);
    expect(r.error).toContain("503");
    expect(mod.getBufferHealth().eventCount).toBe(2);
  });

  it("retries the same events on the next tick, then drains", async () => {
    mod.ingestEvent(event());
    let failNext = true;
    const send = vi.fn(async () => {
      if (failNext) {
        failNext = false;
        throw new Error("connection refused");
      }
    });

    expect((await mod.flushToControlPlane(send, "https://c.example.com")).flushed).toBe(0);
    expect((await mod.flushToControlPlane(send, "https://c.example.com")).flushed).toBe(1);
    expect(mod.getBufferHealth().eventCount).toBe(0);
  });

  it("does not drop events when no control plane is configured", async () => {
    mod.ingestEvent(event());
    const r = await mod.flushToControlPlane(vi.fn(), undefined);
    expect(r.flushed).toBe(0);
    expect(r.remaining).toBe(1);
    expect(r.error).toContain("ARM_CONTROL_PLANE_URL");
  });

  it("survives the on-disk segment matching the buffer after a partial drain", async () => {
    for (let i = 0; i < 3; i++) mod.ingestEvent(event());
    await mod.flushToControlPlane(
      vi.fn(async () => {}),
      "https://c.example.com",
    );
    // Segment is rewritten from the (now empty) buffer, so a restart here
    // must not resurrect events the control plane already has.
    mod.__resetBuffer();
    expect(mod.loadBuffer().loaded).toBe(0);
  });
});

describe("health", () => {
  it("reports critical when events are buffered with nowhere to drain", () => {
    // Silent buffering is the failure that looks like success: the dashboard
    // shows no spend and nothing is obviously broken.
    mod.ingestEvent(event());
    const h = mod.getBufferHealth();
    expect(h.drainConfigured).toBe(false);
    expect(h.status).toBe("critical");
  });

  it("reports ok on an empty buffer", () => {
    expect(mod.getBufferHealth().status).toBe("ok");
  });

  it("surfaces the last flush error so /health explains the backlog", async () => {
    mod.ingestEvent(event());
    await mod.flushToControlPlane(
      vi.fn(async () => {
        throw new Error("ingest returned 401: unauthorized");
      }),
      "https://c.example.com",
    );
    expect(mod.getBufferHealth().lastFlushError).toContain("401");
  });
});
