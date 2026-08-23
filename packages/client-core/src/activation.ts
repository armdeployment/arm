/**
 * Client-side activation events (docs/guides/03-client-downloader.md §5,
 * §6 spec §4.2 delta). `runSetup` emits `installed`, `runtime_ready`,
 * `connections_started`, `connections_completed`, `first_metered_call` (and
 * error variants) — each with a duration and, on failure, a stable
 * `error_code` (errors.ts). These are METADATA ONLY (Invariant 1 / A5): no
 * prompt bodies, no free text, `user_ref` is pseudonymous — never an email.
 *
 * Emission is best-effort: a dropped telemetry POST must never fail setup.
 */

import { activationEventSchema, type ActivationEvent, type ActivationStep } from "@arm/proto";
import type { ArmErrorCode } from "./errors.js";

export interface ActivationEventInput {
  tenantId: string;
  /** Pseudonymous id — NEVER an email (Invariant 1). */
  userRef: string;
  step: ActivationStep;
  orgNodeId?: string;
  jobFunctionKey?: string;
  outcome?: "ok" | "error" | "abandoned";
  packageVersionId?: string;
  clientVersion?: string;
  errorCode?: ArmErrorCode;
  durationMs?: number;
}

/** Local-time ISO string (no offset) — matches `datetime({ local: true })`. */
function localNowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

/** Build (and validate) an activation event — pure, no I/O. */
export function buildActivationEvent(input: ActivationEventInput): ActivationEvent {
  return activationEventSchema.parse({
    ts: localNowIso(),
    tenant_id: input.tenantId,
    org_node_id: input.orgNodeId ?? "unknown",
    user_ref: input.userRef,
    job_function_key: input.jobFunctionKey ?? "",
    step: input.step,
    outcome: input.outcome ?? "ok",
    package_version_id: input.packageVersionId ?? "",
    client_version: input.clientVersion ?? "",
    error_code: input.errorCode ?? "",
    duration_ms: input.durationMs ?? 0,
  });
}

/**
 * POST an activation event to the control plane. NEVER throws — network
 * failure, non-200, or a slow control plane must not fail (or even delay)
 * `arm setup`; this is best-effort telemetry, not a metered/authoritative
 * call. Swallows all errors after a short timeout.
 */
export async function emitActivationEvent(
  controlPlaneUrl: string,
  event: ActivationEvent,
): Promise<void> {
  try {
    await fetch(`${controlPlaneUrl.replace(/\/+$/, "")}/api/events/activation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // best-effort — never fail setup for dropped telemetry
  }
}

/** Build + emit in one call — the shape `runSetup` uses at each step. */
export async function trackActivation(
  controlPlaneUrl: string,
  input: ActivationEventInput,
): Promise<void> {
  await emitActivationEvent(controlPlaneUrl, buildActivationEvent(input));
}
