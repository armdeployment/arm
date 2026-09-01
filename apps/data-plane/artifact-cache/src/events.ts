/**
 * `component_pull_event` emission — metadata only (guide 01 §5, §11.1).
 *
 * No component_id/version is knowable purely from a digest at the HTTP
 * layer (the digest is the primary key here, not the component); callers
 * pass whatever they know from the request.
 *
 * These used to buffer in-process and go nowhere — the module carried
 * `TODO(1.1): ship to ClickHouse instead of buffering in-process`, so the
 * adoption panels had no pull data and cache-hit accounting was invisible.
 * They now flush to the control plane's `/api/ingest/component-pull`, over
 * HTTP rather than a ClickHouse client: the data-plane boundary allows
 * proto/config/client-core only, and content never crosses — only metadata.
 *
 * Delivery discipline matches the meter-agent: events are removed only after
 * a 2xx, so a failure retries rather than drops. The buffer is bounded and in
 * memory rather than on disk, which is the deliberate difference — a lost
 * pull event costs an adoption datapoint, where a lost metering event costs
 * money, so this does not earn the complexity of a disk segment.
 */

import { componentPullEventSchema, type ComponentPullEvent } from "@arm/proto";
import { config } from "@arm/config";

export interface RecordPullInput {
  tenantId: string;
  componentId: string;
  version: string;
  blobDigest: string;
  bytes: number;
  cacheHit: boolean;
  clientVersion?: string;
}

const pullEventBuffer: ComponentPullEvent[] = [];

export function buildComponentPullEvent(input: RecordPullInput): ComponentPullEvent {
  return componentPullEventSchema.parse({
    ts: new Date().toISOString().slice(0, 19),
    tenant_id: input.tenantId,
    component_id: input.componentId,
    version: input.version,
    blob_digest: input.blobDigest,
    bytes: input.bytes,
    cache_hit: input.cacheHit ? 1 : 0,
    client_version: input.clientVersion ?? "",
  });
}

let droppedCount = 0;

export function recordPull(input: RecordPullInput): ComponentPullEvent {
  const event = buildComponentPullEvent(input);
  pullEventBuffer.push(event);
  // Drop oldest first once bounded. Recent data is the useful data for an
  // adoption count, and an unbounded buffer would turn a control-plane outage
  // into an artifact-cache memory leak.
  while (pullEventBuffer.length > MAX_BUFFERED) {
    pullEventBuffer.shift();
    droppedCount++;
  }
  return event;
}

export function getPullEventBuffer(): readonly ComponentPullEvent[] {
  return pullEventBuffer;
}

/** Test-only reset — mirrors the pattern other data-plane apps would need
 *  if their in-memory buffers were exported (this one is, for testability). */
export function clearPullEventBuffer(): void {
  pullEventBuffer.length = 0;
  lastFlushError = null;
}

// ── Flush to the control plane ─────────────────────────────────────────────

/** Bounded: a control plane that is down for a long time must not grow this
 *  without limit. The oldest events are dropped first — for adoption counts,
 *  recent data is the useful data. */
const MAX_BUFFERED = 5000;
/** One POST carries at most this many, matching proto's batch cap. */
const FLUSH_BATCH_SIZE = 1000;

let lastFlushError: string | null = null;
const SOURCE_ID =
  process.env.ARM_DATA_PLANE_ID ?? `artifact-cache@${process.env.HOSTNAME ?? "local"}`;

export type PullBatchSender = (batch: unknown, url: string) => Promise<void>;

const defaultSender: PullBatchSender = async (batch, url) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.ARM_INGEST_TOKEN) headers["authorization"] = `Bearer ${config.ARM_INGEST_TOKEN}`;
  const res = await fetch(`${url.replace(/\/+$/, "")}/api/ingest/component-pull`, {
    method: "POST",
    headers,
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    throw new Error(`ingest returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
};

export interface PullFlushResult {
  flushed: number;
  remaining: number;
  error?: string;
}

/**
 * Ships buffered pull events. Removes them only after the POST succeeds.
 */
export async function flushPullEvents(
  send: PullBatchSender = defaultSender,
  controlPlaneUrl: string | undefined = config.ARM_CONTROL_PLANE_URL,
): Promise<PullFlushResult> {
  if (pullEventBuffer.length === 0) return { flushed: 0, remaining: 0 };
  if (!controlPlaneUrl) {
    lastFlushError = "ARM_CONTROL_PLANE_URL is not set — buffering, not draining";
    return { flushed: 0, remaining: pullEventBuffer.length, error: lastFlushError };
  }

  let flushed = 0;
  while (pullEventBuffer.length > 0) {
    const batch = pullEventBuffer.slice(0, FLUSH_BATCH_SIZE);
    try {
      await send({ source_id: SOURCE_ID, events: batch }, controlPlaneUrl);
    } catch (err) {
      lastFlushError = err instanceof Error ? err.message : String(err);
      return { flushed, remaining: pullEventBuffer.length, error: lastFlushError };
    }
    pullEventBuffer.splice(0, batch.length);
    flushed += batch.length;
  }
  lastFlushError = null;
  return { flushed, remaining: 0 };
}

export function getPullFlushHealth(): {
  buffered: number;
  dropped: number;
  drainConfigured: boolean;
  lastFlushError: string | null;
} {
  return {
    buffered: pullEventBuffer.length,
    dropped: droppedCount,
    drainConfigured: Boolean(config.ARM_CONTROL_PLANE_URL),
    lastFlushError,
  };
}
