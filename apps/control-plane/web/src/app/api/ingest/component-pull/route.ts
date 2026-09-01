import { componentPullBatchSchema } from "@arm/proto";
import { handleIngest } from "@/lib/ingest";

/** Force dynamic — an ingest endpoint must never be prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * Component-pull ingest.
 *
 * `apps/data-plane/artifact-cache` records a `component_pull_event` for every
 * blob fetch — which component, which version, how many bytes, cache hit or
 * miss. Those events buffered in-process and went nowhere: the module carried
 * `TODO(1.1): ship to ClickHouse instead of buffering in-process`, so the
 * adoption panels had no pull data to read and cache-hit accounting was
 * invisible.
 *
 * Same auth, same Invariant 1 boundary check and same fixture-mode contract as
 * the metering route, from `@/lib/ingest`.
 */
export async function POST(req: Request): Promise<Response> {
  return handleIngest(req, {
    table: "component_pull_event",
    label: "component-pull",
    parse: (raw) => {
      const parsed = componentPullBatchSchema.safeParse(raw);
      return parsed.success
        ? { success: true, events: parsed.data.events }
        : { success: false, detail: parsed.error.issues.slice(0, 5) };
    },
  });
}
