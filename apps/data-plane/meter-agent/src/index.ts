/**
 * ARM Meter-Agent (spec §5.2, §9 1.2).
 *
 * Consolidates metering events from proxy / open-gateway / plugins /
 * connectors and pushes metadata-only events to the control plane. This is
 * the only path by which anything an agent costs reaches the dashboard, so
 * the properties that matter are durability and at-least-once delivery.
 *
 * What this replaces, because the difference is the whole point:
 *
 *   - The buffer was in memory, while the file header claimed "a disk-backed
 *     buffer with bounded retention" and `METER_AGENT_BUFFER_DIR` had existed
 *     in @arm/config since the scaffold. A restart lost every unflushed event.
 *   - `flushToControlPlane` emptied the buffer and returned the count as
 *     `flushed`, without sending anything anywhere. It reported success for
 *     discarding data.
 *   - There was no entrypoint, no listener and no timer, so none of it ran.
 *     Nothing imported this module either — the proxy's own metering buffer
 *     was a separate array that also went nowhere.
 *   - Its event schema was a camelCase copy (`subAccountId`, `costUsd`) that
 *     did not match `token_usage_event` or `@arm/proto`, so even a connected
 *     pipeline would have rejected every event.
 *
 * Durability model: events append to a JSONL segment under
 * METER_AGENT_BUFFER_DIR and are read back on start. A flush POSTs a batch
 * and only rewrites the segment after a 2xx. A crash mid-flush therefore
 * re-sends rather than drops — at-least-once, which for spend accounting is
 * the correct side to err on (ClickHouse dedupes on identical rows far more
 * cheaply than anyone reconstructs a missing day's cost).
 *
 * Boundary: data-plane apps may import @arm/proto and @arm/config only
 * (AGENTS.md, `boundaries` guardrail). Hence HTTP to the control plane rather
 * than a ClickHouse client here — content never crosses, only metadata.
 */

import { createServer } from "node:http";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "@arm/config";
import { tokenUsageEventSchema, type TokenUsageEvent, type MeteringBatch } from "@arm/proto";

const BUFFER_DIR = config.METER_AGENT_BUFFER_DIR;
const SEGMENT = join(BUFFER_DIR, "metering.jsonl");
const MAX_BUFFER_EVENTS = 10_000;
const MAX_BUFFER_BYTES = config.METER_AGENT_BUFFER_MAX_BYTES;
const MAX_AGE_HOURS = config.METER_AGENT_BUFFER_MAX_AGE_HOURS;
/** One POST carries at most this many events — matches proto's batch cap. */
const FLUSH_BATCH_SIZE = 1000;

// ── Buffer ─────────────────────────────────────────────────────────────────

interface BufferState {
  events: TokenUsageEvent[];
  totalBytes: number;
  droppedCount: number;
  /** Set when a flush fails, so /health can report why nothing is draining. */
  lastFlushError: string | null;
  lastFlushAt: string | null;
}

const state: BufferState = {
  events: [],
  totalBytes: 0,
  droppedCount: 0,
  lastFlushError: null,
  lastFlushAt: null,
};

/** Age of the oldest buffered event, or 0 when empty. */
function oldestAgeMs(): number {
  const first = state.events[0];
  if (!first) return 0;
  const age = Date.now() - new Date(first.ts).getTime();
  return age > 0 ? age : 0;
}

/**
 * Rewrites the on-disk segment from the in-memory buffer.
 *
 * Written to a temp file and renamed, so a crash mid-write leaves the
 * previous segment intact rather than a truncated one. Losing a flush's worth
 * of progress means re-sending; losing the segment means losing the events.
 */
function persist(): void {
  mkdirSync(BUFFER_DIR, { recursive: true });
  const tmp = `${SEGMENT}.tmp`;
  writeFileSync(
    tmp,
    state.events.map((e) => JSON.stringify(e)).join("\n") + (state.events.length ? "\n" : ""),
  );
  renameSync(tmp, SEGMENT);
}

/**
 * Reloads the buffer from disk. Malformed lines are counted as dropped and
 * skipped rather than failing startup — a single corrupt line at the tail
 * (the likely shape of a crash) must not strand every event before it.
 */
export function loadBuffer(): { loaded: number; corrupt: number } {
  state.events = [];
  state.totalBytes = 0;
  if (!existsSync(SEGMENT)) return { loaded: 0, corrupt: 0 };

  let corrupt = 0;
  for (const line of readFileSync(SEGMENT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = tokenUsageEventSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        corrupt++;
        continue;
      }
      state.events.push(parsed.data);
      state.totalBytes += line.length;
    } catch {
      corrupt++;
    }
  }
  state.droppedCount += corrupt;
  return { loaded: state.events.length, corrupt };
}

/** Accepts a metering event from proxy / gateway / plugin. */
export function ingestEvent(raw: unknown): { accepted: boolean; reason?: string } {
  const parsed = tokenUsageEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { accepted: false, reason: `validation_failed: ${parsed.error.message}` };
  }

  const line = JSON.stringify(parsed.data);
  if (
    state.events.length >= MAX_BUFFER_EVENTS ||
    state.totalBytes + line.length > MAX_BUFFER_BYTES
  ) {
    state.droppedCount++;
    return { accepted: false, reason: "buffer_full" };
  }

  state.events.push(parsed.data);
  state.totalBytes += line.length;

  // Append rather than rewrite: an ingest is O(1) on disk, and the rewrite
  // only happens on flush. mkdir on every append is cheap and means a deleted
  // buffer directory heals instead of throwing on each event.
  mkdirSync(BUFFER_DIR, { recursive: true });
  appendFileSync(SEGMENT, line + "\n");

  return { accepted: true };
}

export interface BufferHealth {
  eventCount: number;
  totalBytes: number;
  oldestAgeMs: number;
  droppedCount: number;
  status: "ok" | "warning" | "critical";
  lastFlushError: string | null;
  lastFlushAt: string | null;
  /** False when no control plane is configured — the agent cannot drain. */
  drainConfigured: boolean;
}

export function getBufferHealth(): BufferHealth {
  const ageHours = oldestAgeMs() / 3_600_000;
  const drainConfigured = Boolean(config.ARM_CONTROL_PLANE_URL);
  const status: BufferHealth["status"] =
    state.droppedCount > 100 || (!drainConfigured && state.events.length > 0)
      ? "critical"
      : ageHours > MAX_AGE_HOURS || state.lastFlushError
        ? "warning"
        : "ok";
  return {
    eventCount: state.events.length,
    totalBytes: state.totalBytes,
    oldestAgeMs: oldestAgeMs(),
    droppedCount: state.droppedCount,
    status,
    lastFlushError: state.lastFlushError,
    lastFlushAt: state.lastFlushAt,
    drainConfigured,
  };
}

// ── Flush ──────────────────────────────────────────────────────────────────

export interface FlushResult {
  flushed: number;
  remaining: number;
  error?: string;
}

/** Injectable so tests exercise retry and partial-drain without a network. */
export type BatchSender = (batch: MeteringBatch, url: string) => Promise<void>;

const defaultSender: BatchSender = async (batch, url) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.ARM_INGEST_TOKEN) {
    headers["authorization"] = `Bearer ${config.ARM_INGEST_TOKEN}`;
  }
  const res = await fetch(`${url.replace(/\/+$/, "")}/api/ingest/metering`, {
    method: "POST",
    headers,
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    throw new Error(`ingest returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
};

/**
 * Flushes buffered events to the control plane.
 *
 * Events are removed only after the POST succeeds. A failure leaves the
 * buffer exactly as it was and records the reason, so the next tick retries
 * the same events rather than losing them — the behaviour the previous
 * implementation inverted by clearing first and never sending.
 */
export async function flushToControlPlane(
  send: BatchSender = defaultSender,
  controlPlaneUrl: string | undefined = config.ARM_CONTROL_PLANE_URL,
): Promise<FlushResult> {
  if (state.events.length === 0) {
    return { flushed: 0, remaining: 0 };
  }
  if (!controlPlaneUrl) {
    const error = "ARM_CONTROL_PLANE_URL is not set — buffering, not draining";
    state.lastFlushError = error;
    return { flushed: 0, remaining: state.events.length, error };
  }

  let flushed = 0;
  while (state.events.length > 0) {
    const batch = state.events.slice(0, FLUSH_BATCH_SIZE);
    try {
      await send({ source_id: SOURCE_ID, events: batch }, controlPlaneUrl);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      state.lastFlushError = error;
      // Anything already sent this call is durably gone from the buffer; the
      // rest stays for the next tick.
      if (flushed > 0) persist();
      return { flushed, remaining: state.events.length, error };
    }
    state.events.splice(0, batch.length);
    state.totalBytes = state.events.reduce((n, e) => n + JSON.stringify(e).length, 0);
    flushed += batch.length;
  }

  persist();
  state.lastFlushError = null;
  state.lastFlushAt = new Date().toISOString();
  return { flushed, remaining: state.events.length };
}

/** Test seam — resets module state between cases. */
export function __resetBuffer(): void {
  state.events = [];
  state.totalBytes = 0;
  state.droppedCount = 0;
  state.lastFlushError = null;
  state.lastFlushAt = null;
}

const SOURCE_ID = process.env.ARM_DATA_PLANE_ID ?? `meter-agent@${process.env.HOSTNAME ?? "local"}`;

// ── HTTP surface ───────────────────────────────────────────────────────────

const json = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

export function createMeterAgentServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      const health = getBufferHealth();
      return json(res, health.status === "critical" ? 503 : 200, {
        status: health.status === "ok" ? "ok" : "degraded",
        service: "meter-agent",
        version: "0.0.0",
        buffer: health,
      });
    }

    if (req.method === "POST" && url.pathname === "/events") {
      const chunks: Buffer[] = [];
      for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString() || "null");
      } catch {
        return json(res, 400, { error: "invalid_json" });
      }
      // Accepts one event or an array, so an emitter never has to batch.
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      const results = incoming.map((e) => ingestEvent(e));
      const accepted = results.filter((r) => r.accepted).length;
      const rejected = results.filter((r) => !r.accepted);
      return json(res, rejected.length > 0 && accepted === 0 ? 422 : 202, {
        accepted,
        rejected: rejected.map((r) => r.reason),
      });
    }

    if (req.method === "POST" && url.pathname === "/flush") {
      return json(res, 200, await flushToControlPlane());
    }

    return json(res, 404, { error: "not_found" });
  });
}

// ── Entrypoint ─────────────────────────────────────────────────────────────
//
// Guarded, so importing this module from a test or another service does not
// bind a port or start a timer.
const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const { loaded, corrupt } = loadBuffer();
  if (loaded > 0 || corrupt > 0) {
    console.log(
      `[meter-agent] recovered ${loaded} buffered event(s) from ${SEGMENT}${corrupt ? `, skipped ${corrupt} corrupt line(s)` : ""}`,
    );
  }
  if (!config.ARM_CONTROL_PLANE_URL) {
    console.warn(
      "[meter-agent] ARM_CONTROL_PLANE_URL is not set — events will buffer to disk and never drain. /health reports degraded.",
    );
  }

  const timer = setInterval(() => {
    void flushToControlPlane().then((r) => {
      if (r.flushed > 0)
        console.log(`[meter-agent] flushed ${r.flushed} event(s), ${r.remaining} remaining`);
      else if (r.error) console.warn(`[meter-agent] flush failed: ${r.error}`);
    });
  }, config.METER_AGENT_FLUSH_INTERVAL_MS);
  timer.unref();

  // A shutdown that drops the buffer would defeat the disk segment, so drain
  // what we can and leave the rest on disk for the next start.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      void flushToControlPlane().finally(() => {
        persist();
        process.exit(0);
      });
    });
  }

  createMeterAgentServer().listen(config.METER_AGENT_PORT, () =>
    console.log(`[meter-agent] http://localhost:${config.METER_AGENT_PORT} — buffer ${SEGMENT}`),
  );
}

export { SEGMENT as BUFFER_SEGMENT_PATH };
