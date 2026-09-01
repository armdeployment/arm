import { meteringBatchSchema } from "@arm/proto";
import { handleIngest } from "@/lib/ingest";

/** Force dynamic — an ingest endpoint must never be prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * Metering ingest — the control-plane end of the data plane's outbound path.
 *
 * `apps/data-plane/meter-agent` POSTs batches here and this writes them to
 * ClickHouse `token_usage_event`. Until this route existed the meter-agent's
 * flush carried `TODO(1.2): POST state.events to control-plane
 * /api/ingest/metering` and this did not exist — so nothing an agent cost
 * ever reached the dashboard, whatever the spend panels showed.
 *
 * Auth and the Invariant 1 boundary check live in `@/lib/ingest`, shared with
 * the component-pull route so the two cannot drift.
 */
export async function POST(req: Request): Promise<Response> {
  return handleIngest(req, {
    table: "token_usage_event",
    label: "metering",
    parse: (raw) => {
      const parsed = meteringBatchSchema.safeParse(raw);
      return parsed.success
        ? { success: true, events: parsed.data.events }
        : { success: false, detail: parsed.error.issues.slice(0, 5) };
    },
  });
}
