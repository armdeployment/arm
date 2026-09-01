import { meteringBatchSchema, type TokenUsageEvent } from "@arm/proto";
import { config } from "@arm/config";

/** Force dynamic — an ingest endpoint must never be prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * Metering ingest — the control-plane end of the data plane's only outbound path.
 *
 * `apps/data-plane/meter-agent` POSTs batches here and this writes them to
 * ClickHouse `token_usage_event`. Until now the meter-agent's flush carried a
 * `TODO(1.2): POST state.events to control-plane /api/ingest/metering`, and
 * this route did not exist — so nothing an agent cost ever reached the
 * dashboard, whatever the spend panels showed.
 *
 * Invariant 1 / A5 — the control plane is metadata and audit only. The batch
 * schema in @arm/proto admits no content field, and `assertMetadataOnly`
 * re-checks every event for content-shaped keys. That is deliberate
 * belt-and-braces: the `no-content-egress` guardrail checks the *schema*, and
 * this checks the *payload*, because a sender is free to add keys a schema
 * simply ignores.
 *
 * Order matters, and the first version of this route got it wrong. The check
 * ran on the zod OUTPUT, but zod strips unknown keys by default — so a batch
 * carrying `prompt: "..."` had it silently removed before the guard looked,
 * and the sender got a 200. Content never reached ClickHouse (there is no
 * column for it), but nothing told the data plane it had just tried to push a
 * prompt body across the trust boundary, which is precisely the signal this
 * exists to raise. The check now runs on the raw payload, before parsing.
 */

/** Keys that must never appear on an inbound event, whatever the schema says. */
const FORBIDDEN_KEYS = [
  "prompt",
  "completion",
  "content",
  "body",
  "text",
  "messages",
  "response",
  "secret",
  "api_key",
  "access_token",
];

export function assertMetadataOnly(event: Record<string, unknown>): string | null {
  for (const key of Object.keys(event)) {
    const lower = key.toLowerCase();
    const hit = FORBIDDEN_KEYS.find((f) => lower === f || lower.includes(f));
    // `work_type`/`usage_tags`/`model_id` are metadata; only exact-or-substring
    // matches on the content words above are rejected.
    if (hit) return `content-shaped key "${key}" (matched "${hit}") — Invariant 1`;
  }
  return null;
}

/** ClickHouse connection strings carry credentials in the URL; fetch rejects
 *  those, so they move to a Basic header. Same handling as adoption-router. */
function clickHouseRequestTarget(rawUrl: string): { url: string; headers: Record<string, string> } {
  const parsed = new URL(rawUrl);
  const headers: Record<string, string> = {};
  if (parsed.username || parsed.password) {
    headers["Authorization"] =
      `Basic ${Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64")}`;
    parsed.username = "";
    parsed.password = "";
  }
  return { url: parsed.toString().replace(/\/+$/, ""), headers };
}

async function insertEvents(events: TokenUsageEvent[]): Promise<void> {
  const { url: base, headers } = clickHouseRequestTarget(config.CLICKHOUSE_URL!);
  const rows = events.map((e) => JSON.stringify(e)).join("\n");
  const res = await fetch(
    `${base}/?query=${encodeURIComponent("INSERT INTO token_usage_event FORMAT JSONEachRow")}`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: rows,
    },
  );
  if (!res.ok) {
    throw new Error(
      `ClickHouse insert failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}

/**
 * Authenticates the sending data plane.
 *
 * Returns null when authorized, or the response to return when not. An open
 * ingest endpoint lets anyone write another tenant's spend, so this refuses in
 * production when no token is configured rather than defaulting to open.
 */
export function checkIngestAuth(
  authorization: string | null,
  token: string | undefined = config.ARM_INGEST_TOKEN,
  nodeEnv: string = config.NODE_ENV,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!token) {
    if (nodeEnv === "production") {
      return {
        ok: false,
        status: 503,
        error:
          "ingest_not_configured: ARM_INGEST_TOKEN is unset under NODE_ENV=production. " +
          "Refusing rather than accepting unauthenticated spend for any tenant.",
      };
    }
    // Development: accept unauthenticated so the local pipeline works with no
    // configuration, matching ARM_FIXTURE_MODE=1 everywhere else.
    return { ok: true };
  }
  const presented = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!presented || presented !== token) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

export async function POST(req: Request): Promise<Response> {
  const auth = checkIngestAuth(req.headers.get("authorization"));
  if (!auth.ok) {
    console.error(`[ingest] rejected: ${auth.error}`);
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  // Boundary check FIRST, on the raw payload — zod would strip the very keys
  // this is looking for. A batch carrying content is a trust-boundary
  // violation, not a bad row: reject the whole thing loudly rather than
  // quietly writing the clean remainder and telling the sender nothing.
  const rejected: Array<{ index: number; reason: string }> = [];
  const rawEvents = (raw as { events?: unknown })?.events;
  if (Array.isArray(rawEvents)) {
    rawEvents.forEach((event, index) => {
      if (event && typeof event === "object") {
        const violation = assertMetadataOnly(event as Record<string, unknown>);
        if (violation) rejected.push({ index, reason: violation });
      }
    });
  }
  if (rejected.length > 0) {
    const sourceId = (raw as { source_id?: unknown })?.source_id;
    console.error(`[ingest] boundary violation from ${String(sourceId)}: ${rejected[0]!.reason}`);
    return Response.json({ error: "content_in_control_plane", rejected }, { status: 422 });
  }

  const parsed = meteringBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_batch", detail: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  }

  const accepted: TokenUsageEvent[] = parsed.data.events;

  if (!config.CLICKHOUSE_URL) {
    // Fixture mode: the pipeline is exercised end to end without a database,
    // the same bargain every router here makes. Reported honestly as
    // persisted:false so a caller cannot mistake this for durable storage.
    console.log(
      `[ingest] fixture mode — accepted ${accepted.length} event(s) from ${parsed.data.source_id}, not persisted`,
    );
    return Response.json({ accepted: accepted.length, rejected: [], persisted: false });
  }

  try {
    await insertEvents(accepted);
  } catch (err) {
    // 5xx, so the meter-agent keeps the events and retries rather than
    // treating a database outage as delivery.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] persist failed: ${message}`);
    return Response.json({ error: "persist_failed", detail: message }, { status: 503 });
  }

  return Response.json({ accepted: accepted.length, rejected: [], persisted: true });
}
