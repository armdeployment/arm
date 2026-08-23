import { activationEventSchema } from "@arm/proto";

export const dynamic = "force-dynamic";

/**
 * Activation-event ingestion (docs/guides/03-client-downloader.md §3, §5).
 * `apps/onboarding`'s pages emit `questionnaire_started`,
 * `questionnaire_completed`, `token_issued`, `downloaded`; the downloaded
 * client (`@arm/client-core`'s `emitActivationEvent`) emits `installed`,
 * `runtime_ready`, `connections_started`, `connections_completed`,
 * `first_metered_call`. Every event is METADATA ONLY (Invariant 1 / A5) —
 * `activationEventSchema` has no content-bearing field (no-content-in-
 * activation guardrail).
 *
 * In-memory log — this scaffold has no live ClickHouse write path yet
 * (matching every other router's fixture-only maturity level here);
 * `server`'s adoption-router.ts reads the real `activation_event` table
 * once that lands (docs/guides/02-server-panels.md). Exported for tests.
 */
export const activationEventLog: unknown[] = [];

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = activationEventSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }
  activationEventLog.push(parsed.data);
  return new Response(null, { status: 202 });
}
