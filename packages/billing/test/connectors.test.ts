/**
 * Provider usage connectors.
 *
 * Both used to return seeded fixtures unconditionally with a
 * `TODO(1.1): Replace with real ... Admin API call`, and the seeds used
 * `Math.random()` — so `reconcile` compared ARM's real metering against
 * made-up numbers that changed on every call, and reported the difference to
 * one decimal place as though it were a measurement.
 *
 * The real calls cannot be exercised against a live account here (this repo
 * has no admin credential), so `fetchUsage` takes an injectable fetcher and
 * these tests drive the response mapping with the documented response shape.
 * That is the part worth pinning: the HTTP is trivial, the mapping is not.
 */

import { describe, it, expect, vi } from "vitest";
import {
  anthropicConnector,
  openaiConnector,
  reconcile,
  resolveProviderKey,
  type UsageFetcher,
} from "../src/index.js";

// The connectors resolve `env:K` through process.env before they call the
// fetcher, so the mapping tests need a value there.
process.env.K = "test-admin-key";

const START = new Date("2026-07-01T00:00:00Z");
const END = new Date("2026-07-02T00:00:00Z");

const jsonResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe("resolveProviderKey", () => {
  it("reads an env: reference", () => {
    expect(resolveProviderKey("env:MY_KEY", { MY_KEY: "sk-live" })).toEqual({ key: "sk-live" });
  });

  it("reports an env: reference that is not set, rather than throwing", () => {
    const r = resolveProviderKey("env:MISSING", {});
    expect(r.key).toBeNull();
    expect(r.key === null && r.reason).toContain("MISSING");
  });

  it("declines a vault: reference — ARM has no vault client", () => {
    // Returning null rather than throwing matters: a nightly reconciliation
    // job should degrade to "cannot compare", not crash.
    const r = resolveProviderKey("vault:tenant/acme/anthropic");
    expect(r.key).toBeNull();
    expect(r.key === null && r.reason).toContain("vault");
  });

  it("never returns the raw ref as a key (Invariant 4)", () => {
    expect(resolveProviderKey("sk-ant-actually-a-key").key).toBeNull();
  });
});

describe("anthropic connector", () => {
  it("maps the admin usage report into daily rows", async () => {
    const fetcher: UsageFetcher = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            starting_at: "2026-07-01T00:00:00Z",
            results: [
              {
                model: "claude-sonnet-4-20250514",
                uncached_input_tokens: 1_000_000,
                output_tokens: 200_000,
              },
            ],
          },
        ],
      }),
    );
    const r = await anthropicConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(r.source).toBe("provider_api");
    expect(r.days).toHaveLength(1);
    // 1M in @ $3/M + 200k out @ $15/M = 3 + 3 = $6
    expect(r.days[0]!.costUsd).toBeCloseTo(6, 2);
    expect(r.totalCostUsd).toBeCloseTo(6, 2);
  });

  it("prices a dated model id by longest-prefix match", async () => {
    // "claude-sonnet-4-20250514" must price as sonnet, not fall to a default.
    const fetcher: UsageFetcher = async () =>
      jsonResponse({
        data: [
          {
            starting_at: "2026-07-01T00:00:00Z",
            results: [
              {
                model: "claude-haiku-4-20250101",
                uncached_input_tokens: 1_000_000,
                output_tokens: 0,
              },
            ],
          },
        ],
      });
    const r = await anthropicConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(r.days[0]!.costUsd).toBeCloseTo(0.8, 2); // haiku rate, not sonnet's 3
  });

  it("falls back to SIMULATED, labelled, when the credential does not resolve", async () => {
    const r = await anthropicConnector.fetchUsage({ apiKeyRef: "vault:acme" }, START, END);
    expect(r.source).toBe("simulated");
    expect(r.sourceDetail).toContain("vault");
  });

  it("falls back rather than throwing when the API errors", async () => {
    const fetcher: UsageFetcher = async () => ({ ok: false, status: 401 }) as unknown as Response;
    const r = await anthropicConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(r.source).toBe("simulated");
    expect(r.sourceDetail).toContain("401");
  });

  it("falls back when the response shape is not what the mapping expects", async () => {
    // A shape change must not silently report zero usage, which reconciliation
    // would then read as 100% drift.
    const fetcher: UsageFetcher = async () => jsonResponse({ unexpected: true });
    const r = await anthropicConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(r.source).toBe("simulated");
    expect(r.sourceDetail).toContain("failed");
  });
});

describe("openai connector", () => {
  it("maps the usage API, converting its unix bucket timestamps", async () => {
    const fetcher: UsageFetcher = async () =>
      jsonResponse({
        data: [
          {
            start_time: Math.floor(Date.UTC(2026, 6, 1) / 1000),
            results: [
              {
                model: "gpt-4o-mini",
                input_tokens: 1_000_000,
                output_tokens: 1_000_000,
                num_model_requests: 42,
              },
            ],
          },
        ],
      });
    const r = await openaiConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(r.source).toBe("provider_api");
    expect(r.days[0]!.date).toBe("2026-07-01");
    expect(r.days[0]!.requests).toBe(42);
    // 1M in @ $0.15/M + 1M out @ $0.60/M = $0.75
    expect(r.days[0]!.costUsd).toBeCloseTo(0.75, 2);
  });

  it("sends the org header only when an orgId is configured", async () => {
    const fetcher: UsageFetcher = vi.fn(async () => jsonResponse({ data: [] }));
    const calls = () =>
      (fetcher as unknown as { mock: { calls: [string, Record<string, string>][] } }).mock.calls;
    await openaiConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    expect(calls()[0]![1]).not.toHaveProperty("openai-organization");
    await openaiConnector.fetchUsage({ apiKeyRef: "env:K", orgId: "org_1" }, START, END, fetcher);
    expect(calls()[1]![1]).toHaveProperty("openai-organization", "org_1");
  });
});

describe("simulated usage is deterministic", () => {
  it("returns the same numbers for the same period", async () => {
    // It used Math.random(), so no two reconciliation runs over one period
    // agreed and no screenshot of the panel was reproducible.
    const a = await anthropicConnector.fetchUsage({ apiKeyRef: "vault:x" }, START, END);
    const b = await anthropicConnector.fetchUsage({ apiKeyRef: "vault:x" }, START, END);
    expect(a.totalCostUsd).toBe(b.totalCostUsd);
    expect(a.days).toEqual(b.days);
  });
});

describe("reconcile refuses simulated data", () => {
  it("reports not_comparable instead of a meaningless drift percentage", async () => {
    const simulated = await anthropicConnector.fetchUsage({ apiKeyRef: "vault:x" }, START, END);
    const r = reconcile(simulated, 1234.56, { "claude-sonnet-4": 1234.56 });
    expect(r.status).toBe("not_comparable");
    expect(r.driftPct).toBe(0);
    expect(r.message).toMatch(/simulated/);
    expect(r.byModel).toEqual([]);
  });

  it("still computes drift for real provider data", async () => {
    const fetcher: UsageFetcher = async () =>
      jsonResponse({
        data: [
          {
            starting_at: "2026-07-01T00:00:00Z",
            results: [
              { model: "claude-sonnet-4", uncached_input_tokens: 1_000_000, output_tokens: 0 },
            ],
          },
        ],
      });
    const real = await anthropicConnector.fetchUsage({ apiKeyRef: "env:K" }, START, END, fetcher);
    const r = reconcile(real, 3, { "claude-sonnet-4": 3 });
    expect(r.status).toBe("ok");
    expect(r.driftPct).toBe(0);
  });
});
