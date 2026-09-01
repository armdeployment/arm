/**
 * Shared machinery for the control plane's ingest endpoints.
 *
 * The control plane has exactly two routes that accept a payload from outside
 * it — metering events and component-pull events, both from the data plane —
 * which makes them the only two places Invariant 1 can be violated by a
 * sender rather than by a schema. Both go through the same auth and the same
 * boundary check, from here, so the two cannot drift into disagreeing about
 * what "content" means or which token is trusted.
 */

import { config } from "@arm/config";

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

/**
 * Rejects an event carrying a content-shaped key.
 *
 * MUST run on the RAW payload, before zod. The first version of the metering
 * route ran it on the zod output, and zod strips unknown keys by default — so
 * a batch carrying `prompt: "..."` had it silently removed before the guard
 * looked, and the sender got a 200. Content never reached ClickHouse (there
 * is no column for it), but nothing told the data plane it had just tried to
 * push a prompt body across the trust boundary, which is the entire point.
 */
export function assertMetadataOnly(event: Record<string, unknown>): string | null {
  for (const key of Object.keys(event)) {
    const lower = key.toLowerCase();
    const hit = FORBIDDEN_KEYS.find((f) => lower === f || lower.includes(f));
    if (hit) return `content-shaped key "${key}" (matched "${hit}") — Invariant 1`;
  }
  return null;
}

/** Runs the boundary check across a raw batch, returning every violation. */
export function findBoundaryViolations(raw: unknown): Array<{ index: number; reason: string }> {
  const violations: Array<{ index: number; reason: string }> = [];
  const events = (raw as { events?: unknown })?.events;
  if (!Array.isArray(events)) return violations;
  events.forEach((event, index) => {
    if (event && typeof event === "object") {
      const reason = assertMetadataOnly(event as Record<string, unknown>);
      if (reason) violations.push({ index, reason });
    }
  });
  return violations;
}

/**
 * Authenticates the sending data plane.
 *
 * Refuses in production when no token is configured rather than defaulting to
 * open: an unauthenticated ingest endpoint lets anyone write another tenant's
 * spend or adoption numbers.
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
          "Refusing rather than accepting unauthenticated data for any tenant.",
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

/** ClickHouse connection strings carry credentials in the URL; fetch rejects
 *  those, so they move to a Basic header. */
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

/** Inserts rows into a ClickHouse table as JSONEachRow. */
export async function insertRows(table: string, rows: unknown[]): Promise<void> {
  const { url: base, headers } = clickHouseRequestTarget(config.CLICKHOUSE_URL!);
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  const res = await fetch(
    `${base}/?query=${encodeURIComponent(`INSERT INTO ${table} FORMAT JSONEachRow`)}`,
    { method: "POST", headers: { ...headers, "content-type": "application/json" }, body },
  );
  if (!res.ok) {
    throw new Error(
      `ClickHouse insert failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}

/**
 * The shape every ingest route shares: authenticate, reject content, validate,
 * then persist — or accept without persisting in fixture mode.
 *
 * Reported honestly as `persisted: false` in fixture mode so a caller cannot
 * mistake acceptance for durable storage.
 */
export async function handleIngest<T>(
  req: Request,
  opts: {
    table: string;
    parse: (raw: unknown) => { success: true; events: T[] } | { success: false; detail: unknown };
    label: string;
  },
): Promise<Response> {
  const auth = checkIngestAuth(req.headers.get("authorization"));
  if (!auth.ok) {
    console.error(`[ingest:${opts.label}] rejected: ${auth.error}`);
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  // Boundary check first, on the raw payload — zod would strip the very keys
  // this looks for. A batch carrying content is a trust-boundary violation,
  // not a bad row: reject the whole thing rather than quietly writing the
  // clean remainder and telling the sender nothing.
  const violations = findBoundaryViolations(raw);
  if (violations.length > 0) {
    console.error(`[ingest:${opts.label}] boundary violation: ${violations[0]!.reason}`);
    return Response.json(
      { error: "content_in_control_plane", rejected: violations },
      { status: 422 },
    );
  }

  const parsed = opts.parse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid_batch", detail: parsed.detail }, { status: 422 });
  }

  if (!config.CLICKHOUSE_URL) {
    console.log(
      `[ingest:${opts.label}] fixture mode — accepted ${parsed.events.length} event(s), not persisted`,
    );
    return Response.json({ accepted: parsed.events.length, rejected: [], persisted: false });
  }

  try {
    await insertRows(opts.table, parsed.events);
  } catch (err) {
    // 5xx, so the sender keeps the events and retries rather than treating a
    // database outage as delivery.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest:${opts.label}] persist failed: ${message}`);
    return Response.json({ error: "persist_failed", detail: message }, { status: 503 });
  }

  return Response.json({ accepted: parsed.events.length, rejected: [], persisted: true });
}
