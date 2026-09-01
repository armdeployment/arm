/**
 * Proxy metering: the wire contract and durable quota.
 *
 * Two things used to be broken here and both were invisible from inside the
 * proxy. Its metering events were shaped `{ subAccountId, model, costUsd }`,
 * which the ClickHouse table and @arm/proto have never accepted — so even
 * once a pipeline existed, every event would have been rejected. And the
 * quota store was a bare Map, so a restart handed every agent its daily cap
 * back.
 *
 * The state directory is redirected before the module loads — @arm/config
 * reads process.env once at import time.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenUsageEventSchema } from "@arm/proto";

const STATE_DIR = mkdtempSync(join(tmpdir(), "arm-proxy-"));
process.env.PROXY_QUOTA_STATE_DIR = STATE_DIR;

type Mod = typeof import("../src/index.js");
let mod: Mod;

beforeAll(async () => {
  mod = await import("../src/index.js");
});

afterAll(() => rmSync(STATE_DIR, { recursive: true, force: true }));

const STATE_FILE = () => join(STATE_DIR, "quota.json");

describe("toTokenUsageEvent — the wire contract", () => {
  const internal = {
    subAccountId: "sa_01",
    agentId: "agt_01",
    tenantId: "tn_01",
    priorityTier: "standard" as const,
    model: "claude-sonnet-4-20250514",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.015,
    source: "proxy" as const,
    ts: new Date().toISOString(),
  };

  it("produces an event @arm/proto accepts", () => {
    const wire = mod.toTokenUsageEvent(internal);
    expect(tokenUsageEventSchema.safeParse(wire).success).toBe(true);
  });

  it("renames every field the ClickHouse table spells differently", () => {
    // model → model_id is the one that is not just a case change, and the one
    // most likely to be reintroduced by hand.
    const wire = mod.toTokenUsageEvent(internal);
    expect(wire).toMatchObject({
      tenant_id: "tn_01",
      sub_account_id: "sa_01",
      agent_id: "agt_01",
      model_id: "claude-sonnet-4-20250514",
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: 0.015,
    });
    expect(wire).not.toHaveProperty("model");
    expect(wire).not.toHaveProperty("costUsd");
  });

  it("leaves an unclassified call as work_type null rather than guessing", () => {
    // D7: `unknown` is first-class and stored as-is, never inferred.
    expect(mod.toTokenUsageEvent(internal).work_type).toBeNull();
  });

  it("carries no content field of any kind (Invariant 1)", () => {
    const wire = mod.toTokenUsageEvent(internal) as Record<string, unknown>;
    for (const key of Object.keys(wire)) {
      expect(key).not.toMatch(/prompt|completion|content|body|message/i);
    }
  });
});

describe("quota durability", () => {
  it("restores consumption written by a previous process", () => {
    // The gap SECURITY.md called out: "restarting the proxy resets
    // consumption; it is not yet a durable enforcement boundary."
    mkdirSync(STATE_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(
      STATE_FILE(),
      JSON.stringify({ day: today, quotas: { sa_x: { dailyCapUsd: 50, usedTodayUsd: 47.5 } } }),
    );
    expect(mod.loadQuotaState()).toEqual({ restored: 1, day: today });
  });

  it("DISCARDS a previous day's file — that is the daily reset", () => {
    writeFileSync(
      STATE_FILE(),
      JSON.stringify({
        day: "2020-01-01",
        quotas: { sa_x: { dailyCapUsd: 50, usedTodayUsd: 49 } },
      }),
    );
    expect(mod.loadQuotaState().restored).toBe(0);
  });

  it("rolls over by clock, so a restart at midnight needs no scheduled job", () => {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(
      STATE_FILE(),
      JSON.stringify({ day: today, quotas: { sa_x: { dailyCapUsd: 50, usedTodayUsd: 10 } } }),
    );
    expect(mod.loadQuotaState(new Date()).restored).toBe(1);
    // A process that comes up "tomorrow" sees the same file as stale.
    const tomorrow = new Date(Date.now() + 25 * 3600_000);
    expect(mod.loadQuotaState(tomorrow).restored).toBe(0);
  });

  it("starts clean rather than crashing on a corrupt state file", () => {
    // A proxy that will not boot is worse than one that starts at zero, which
    // is exactly where the old in-memory store always started.
    writeFileSync(STATE_FILE(), "{ this is not json");
    expect(() => mod.loadQuotaState()).not.toThrow();
    expect(mod.loadQuotaState().restored).toBe(0);
  });

  it("treats a missing state file as a cold start", () => {
    if (existsSync(STATE_FILE())) rmSync(STATE_FILE());
    expect(mod.loadQuotaState().restored).toBe(0);
  });

  it("ignores entries whose shape does not match", () => {
    writeFileSync(
      STATE_FILE(),
      JSON.stringify({
        day: new Date().toISOString().slice(0, 10),
        quotas: { good: { dailyCapUsd: 50, usedTodayUsd: 1 }, bad: { usedTodayUsd: "lots" } },
      }),
    );
    expect(mod.loadQuotaState().restored).toBe(1);
    expect(JSON.parse(readFileSync(STATE_FILE(), "utf8")).quotas).toHaveProperty("bad");
  });
});
