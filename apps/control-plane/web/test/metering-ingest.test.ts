/**
 * Metering ingest — auth and the Invariant 1 boundary.
 *
 * This is the only route in the control plane that accepts a payload from
 * outside it, which makes it the one place Invariant 1 can be violated by a
 * sender rather than by a schema. Both defences are tested here: the guardrail
 * `no-content-egress` checks that no *schema* carries a content column, and
 * `assertMetadataOnly` checks that no *payload* smuggles one past a schema
 * that would otherwise ignore unknown keys.
 */

import { describe, it, expect } from "vitest";
import { assertMetadataOnly, checkIngestAuth, findBoundaryViolations } from "../src/lib/ingest.js";

const validEvent = {
  ts: new Date().toISOString(),
  tenant_id: "tn_01",
  sub_account_id: "sa_01",
  agent_id: "agt_01",
  priority_tier: "standard",
  model_id: "claude-sonnet-4-20250514",
  input_tokens: 100,
  output_tokens: 50,
  cost_usd: 0.01,
  source: "proxy",
};

describe("assertMetadataOnly — Invariant 1 at the payload level", () => {
  it("passes a metadata-only event", () => {
    expect(assertMetadataOnly(validEvent)).toBeNull();
  });

  it("passes the D7/D9 metadata columns that merely look wordy", () => {
    expect(
      assertMetadataOnly({
        ...validEvent,
        work_type: "code_review",
        usage_tags: ["tool:web_search"],
        classifier_version: "3",
        model_id: "gpt-4o",
        package_id: "wp_01",
      }),
    ).toBeNull();
  });

  it.each([
    ["prompt", { prompt: "what is our Q4 revenue" }],
    ["completion", { completion: "..." }],
    ["messages", { messages: [{ role: "user", content: "secret plan" }] }],
    ["content", { content: "resource body" }],
    ["response_body", { response_body: "{}" }],
    ["api_key", { api_key: "sk-live-123" }],
    ["nested-ish key", { prompt_sha256: "abc" }],
  ])("REJECTS a payload carrying %s", (_label, extra) => {
    const violation = assertMetadataOnly({ ...validEvent, ...extra });
    expect(violation).toBeTruthy();
    expect(violation).toContain("Invariant 1");
  });
});

describe("checkIngestAuth", () => {
  it("accepts a matching bearer token", () => {
    expect(checkIngestAuth("Bearer s3cret", "s3cret", "production")).toEqual({ ok: true });
  });

  it("is case-insensitive on the scheme", () => {
    expect(checkIngestAuth("bearer s3cret", "s3cret", "production").ok).toBe(true);
  });

  it("rejects a wrong or missing token when one is configured", () => {
    expect(checkIngestAuth("Bearer wrong", "s3cret", "production")).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(checkIngestAuth(null, "s3cret", "production")).toMatchObject({ ok: false, status: 401 });
  });

  it("REFUSES in production when no token is configured", () => {
    // An open ingest endpoint lets anyone write any tenant's spend. Failing
    // closed is the point — the alternative is silently accepting forged cost.
    const r = checkIngestAuth(null, undefined, "production");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 503 });
    expect(r.ok === false && r.error).toContain("ARM_INGEST_TOKEN");
  });

  it("accepts unauthenticated in development, so the local pipeline needs no config", () => {
    expect(checkIngestAuth(null, undefined, "development")).toEqual({ ok: true });
  });
});

describe("findBoundaryViolations — both ingest routes share this", () => {
  it("names every offending event by index", () => {
    const raw = {
      source_id: "x",
      events: [validEvent, { ...validEvent, prompt: "leak" }, validEvent],
    };
    const violations = findBoundaryViolations(raw);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.index).toBe(1);
  });

  it("is quiet on a clean batch, and on a malformed one", () => {
    expect(findBoundaryViolations({ source_id: "x", events: [validEvent] })).toEqual([]);
    expect(findBoundaryViolations({ nope: true })).toEqual([]);
  });
});

describe("the guard runs on the raw payload, not zod's output", () => {
  it("proves zod strips the very keys the guard looks for", async () => {
    // The bug this pins: assertMetadataOnly originally ran on the PARSED
    // batch. zod objects strip unknown keys by default, so `prompt` was gone
    // before the guard saw it and a batch carrying a prompt body returned 200.
    // Content never reached ClickHouse — there is no column for it — but the
    // sender got no signal it had tried to cross the boundary.
    const { meteringBatchSchema } = await import("@arm/proto");
    const withPrompt = { ...validEvent, prompt: "our Q4 revenue is confidential" };

    // The guard sees it on the raw object …
    expect(assertMetadataOnly(withPrompt)).toContain("Invariant 1");

    // … and would NOT see it after parsing, which is why order matters.
    const parsed = meteringBatchSchema.parse({ source_id: "x", events: [withPrompt] });
    expect(parsed.events[0]).not.toHaveProperty("prompt");
    expect(assertMetadataOnly(parsed.events[0] as Record<string, unknown>)).toBeNull();
  });
});
