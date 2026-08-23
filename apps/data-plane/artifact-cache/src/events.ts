/**
 * `component_pull_event` emission — metadata only (guide 01 §5, §11.1).
 *
 * No component_id/version is knowable purely from a digest at the HTTP
 * layer (the digest is the primary key here, not the component); callers
 * pass whatever they know from the request. Mirrors the in-memory
 * metering-buffer pattern already used by sibling data-plane apps
 * (`apps/data-plane/open-gateway/src/index.ts`'s `meteringBuffer` /
 * `apps/data-plane/proxy`) — TODO(1.1): ship to ClickHouse instead of
 * buffering in-process.
 */

import { componentPullEventSchema, type ComponentPullEvent } from "@arm/proto";

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

export function recordPull(input: RecordPullInput): ComponentPullEvent {
  const event = buildComponentPullEvent(input);
  pullEventBuffer.push(event);
  return event;
}

export function getPullEventBuffer(): readonly ComponentPullEvent[] {
  return pullEventBuffer;
}

/** Test-only reset — mirrors the pattern other data-plane apps would need
 *  if their in-memory buffers were exported (this one is, for testability). */
export function clearPullEventBuffer(): void {
  pullEventBuffer.length = 0;
}
