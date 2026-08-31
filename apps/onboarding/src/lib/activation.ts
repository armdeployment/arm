"use client";

/**
 * Web-side activation-event emission (docs/guides/03-client-downloader.md
 * §3): `questionnaire_started`, `questionnaire_completed`, `token_issued`,
 * `downloaded`. Metadata only — `user_ref` is a pseudonymous id (a random
 * uuid persisted for this browser session), NEVER an email (Invariant 1 / A5).
 */

const USER_REF_KEY = "arm_onboarding_user_ref";
const DEV_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001"; // see api/trpc/[trpc]/route.ts

export type OnboardingStep =
  "questionnaire_started" | "questionnaire_completed" | "token_issued" | "downloaded";

/** A pseudonymous per-browser-session id — never an email or other PII. */
export function getUserRef(): string {
  if (typeof window === "undefined") return "server";
  let ref = window.sessionStorage.getItem(USER_REF_KEY);
  if (!ref) {
    ref = crypto.randomUUID();
    window.sessionStorage.setItem(USER_REF_KEY, ref);
  }
  return ref;
}

export async function emitOnboardingEvent(
  step: OnboardingStep,
  opts: { jobFunctionKey?: string; packageVersionId?: string } = {},
): Promise<void> {
  try {
    await fetch("/api/events/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ts: new Date().toISOString().slice(0, 19),
        tenant_id: DEV_TENANT_ID,
        org_node_id: "unknown",
        user_ref: getUserRef(),
        job_function_key: opts.jobFunctionKey ?? "",
        step,
        outcome: "ok",
        package_version_id: opts.packageVersionId ?? "",
        client_version: "",
        error_code: "",
        duration_ms: 0,
      }),
    });
  } catch {
    // best-effort — never block the flow on dropped telemetry
  }
}
