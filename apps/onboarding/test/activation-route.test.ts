/**
 * Activation-event ingestion route test (docs/guides/03-client-downloader.md
 * §3/§5 — questionnaire_started, questionnaire_completed, token_issued,
 * downloaded, plus the client-side installed/runtime_ready/... steps).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { POST, activationEventLog } from "../src/app/api/events/activation/route.js";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/events/activation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_EVENT = {
  ts: "2026-08-21T10:00:00",
  tenant_id: "d9d9d9d9-0000-4000-8000-000000000001",
  org_node_id: "unknown",
  user_ref: "11111111-1111-1111-1111-111111111111",
  job_function_key: "maintenance_technician",
  step: "questionnaire_started",
  outcome: "ok",
  package_version_id: "",
  client_version: "",
  error_code: "",
  duration_ms: 0,
};

beforeEach(() => {
  activationEventLog.length = 0;
});

describe("POST /api/events/activation", () => {
  it("accepts a well-formed activation event and stores it", async () => {
    const res = await POST(jsonRequest(VALID_EVENT));
    expect(res.status).toBe(202);
    expect(activationEventLog).toHaveLength(1);
  });

  it("silently strips an unrecognized field — activationEventSchema has no content-bearing field to smuggle data through (A5 / Invariant 1)", async () => {
    const res = await POST(jsonRequest({ ...VALID_EVENT, prompt_snippet: "leaked" }));
    expect(res.status).toBe(202);
    const stored = activationEventLog.at(-1) as Record<string, unknown>;
    expect("prompt_snippet" in stored).toBe(false);
  });

  it("rejects a malformed event (missing required fields)", async () => {
    const res = await POST(jsonRequest({ step: "questionnaire_started" }));
    expect(res.status).toBe(400);
    expect(activationEventLog).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/events/activation", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts every one of the four web-side steps", async () => {
    const steps = [
      "questionnaire_started",
      "questionnaire_completed",
      "token_issued",
      "downloaded",
    ];
    for (const step of steps) {
      const res = await POST(jsonRequest({ ...VALID_EVENT, step }));
      expect(res.status).toBe(202);
    }
    expect(activationEventLog).toHaveLength(4);
  });
});
