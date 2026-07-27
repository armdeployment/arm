/**
 * Proto event contract tests (spec §14.1: event-shape stability).
 *
 * These are the zod contract tests mandated by §14.1. They verify:
 *   - Valid events parse successfully.
 *   - Invalid events (wrong types, missing fields) are rejected.
 *   - No content-bearing fields exist in any schema (Invariant §11.1).
 */

import { describe, it, expect } from "vitest";
import {
  tokenUsageEventSchema,
  accessAuditEventSchema,
  ALL_EVENT_FIELDS,
} from "../src/index.js";

describe("token_usage_event contract", () => {
  const valid = {
    ts: new Date().toISOString(),
    tenant_id: "tn_01",
    sub_account_id: "sa_01",
    agent_id: "agt_01",
    priority_tier: "standard" as const,
    model_id: "claude-sonnet-4.5",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.015,
    source: "proxy" as const,
  };

  it("accepts a well-formed event", () => {
    expect(tokenUsageEventSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects negative token counts", () => {
    expect(() =>
      tokenUsageEventSchema.parse({ ...valid, input_tokens: -1 }),
    ).toThrow();
  });

  it("rejects invalid source enum", () => {
    expect(() =>
      tokenUsageEventSchema.parse({ ...valid, source: "hack" }),
    ).toThrow();
  });

  it("rejects invalid priority_tier", () => {
    expect(() =>
      tokenUsageEventSchema.parse({ ...valid, priority_tier: "urgent" }),
    ).toThrow();
  });

  it("rejects missing tenant_id", () => {
    const { tenant_id: _, ...noTenant } = valid;
    expect(() => tokenUsageEventSchema.parse(noTenant)).toThrow();
  });
});

describe("access_audit_event contract", () => {
  const valid = {
    ts: new Date().toISOString(),
    tenant_id: "tn_01",
    agent_id: "agt_01",
    resource_id: "s3://bucket/data",
    action: "read",
    decision: "allow" as const,
    reason: "granted_via_role",
    connector: "s3-mint",
  };

  it("accepts a well-formed event", () => {
    expect(accessAuditEventSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects invalid decision enum", () => {
    expect(() =>
      accessAuditEventSchema.parse({ ...valid, decision: "maybe" }),
    ).toThrow();
  });

  it("rejects empty agent_id", () => {
    expect(() =>
      accessAuditEventSchema.parse({ ...valid, agent_id: "" }),
    ).toThrow();
  });
});

describe("Invariant §11.1 — no content fields in event schemas", () => {
  // The no-content-egress guardrail scans ClickHouse columns; this test
  // verifies the zod contracts themselves carry no content-bearing fields.
  const FORBIDDEN = ["prompt", "completion", "response_text", "body", "content", "secret"];

  it("ALL_EVENT_FIELDS contains no forbidden names", () => {
    const violations = ALL_EVENT_FIELDS.filter((f) =>
      FORBIDDEN.some((fb) => f.toLowerCase().includes(fb)),
    );
    expect(violations).toEqual([]);
  });
});
