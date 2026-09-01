/**
 * ARM Billing package (spec §7, §9 1.1).
 *
 * LLM provider billing-API connectors for daily usage aggregation, cost attribution,
 * and reconciliation. Each connector implements the ProviderConnector interface.
 *
 * Layer 2 (AGENTS.md DAG): may import proto/config only.
 * Real API keys come from config; callers wire them through the connector.
 *
 * Each connector calls the provider's real admin API when a credential
 * resolves, and returns clearly-labelled simulated data when one does not —
 * `ProviderUsageResult.source` says which, and `reconcile` refuses to report
 * drift against simulated numbers rather than producing a meaningless
 * percentage.
 */

import { z } from "zod";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UsageDay {
  date: string; // YYYY-MM-DD
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requests: number;
}

export interface ProviderUsageResult {
  provider: "anthropic" | "openai";
  /**
   * Where these numbers came from.
   *
   * The distinction is load-bearing, not decorative: reconciliation exists to
   * compare the provider's bill against ARM's own metering, and comparing it
   * against simulated data produces a drift percentage that reads like a
   * measurement and is noise. `reconcile` checks this field.
   */
  source: "provider_api" | "simulated";
  /** Why simulated, when it is — an unresolved credential, or a failed call. */
  sourceDetail?: string;
  /** Per-day breakdown for the billing period. */
  days: UsageDay[];
  /** Total cost for the period. */
  totalCostUsd: number;
  /** Total input tokens. */
  totalInputTokens: number;
  /** Total output tokens. */
  totalOutputTokens: number;
  /** Period this data covers (ISO dates). */
  periodStart: string;
  periodEnd: string;
}

export interface ProviderConnectorConfig {
  /** Provider admin API key (vault reference, never logged). */
  apiKeyRef: string;
  /** Organization/workspace ID for the provider. */
  orgId?: string;
}

export interface ProviderConnector {
  readonly provider: "anthropic" | "openai";
  /** Fetches daily usage for the given org/delegate-key for the billing period. */
  fetchUsage(
    config: ProviderConnectorConfig,
    startDate: Date,
    endDate: Date,
    /** Injected in tests so the response mapping runs without a live account. */
    fetcher?: UsageFetcher,
  ): Promise<ProviderUsageResult>;
}

// ── Credential resolution ──────────────────────────────────────────────────

/**
 * Resolves a `apiKeyRef` to an actual provider key.
 *
 * `apiKeyRef` is a *reference*, never the key (Invariant 4 — ARM stores
 * `key_ref`, never the secret). Two forms resolve here:
 *
 *   env:ANTHROPIC_ADMIN_KEY   read that environment variable
 *   vault:tenant/acme/...     NOT resolvable in-process
 *
 * A `vault:` ref returns null rather than throwing: ARM has no vault client
 * yet, and the correct behaviour is to fall back to simulated data saying so,
 * not to crash a nightly reconciliation job.
 */
export function resolveProviderKey(
  apiKeyRef: string,
  env: Record<string, string | undefined> = process.env,
): { key: string } | { key: null; reason: string } {
  if (apiKeyRef.startsWith("env:")) {
    const name = apiKeyRef.slice(4);
    const value = env[name];
    return value
      ? { key: value }
      : { key: null, reason: `apiKeyRef names ${name}, which is not set` };
  }
  if (apiKeyRef.startsWith("vault:")) {
    return {
      key: null,
      reason: "vault: references need a vault client, which ARM does not have yet",
    };
  }
  return {
    key: null,
    reason: `unrecognised apiKeyRef form '${apiKeyRef.split(":")[0]}:' — expected env: or vault:`,
  };
}

/** Injected in tests so the mapping is exercised without a live account. */
export type UsageFetcher = (url: string, headers: Record<string, string>) => Promise<Response>;

const defaultFetcher: UsageFetcher = (url, headers) => fetch(url, { headers });

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Shape of the Anthropic Admin usage report that this maps from.
 *
 * Parsed rather than trusted: an admin API that changes shape should fail
 * loudly here, where the message can say so, instead of silently producing
 * zeroes that reconciliation would report as 100% drift.
 */
const anthropicUsageSchema = z.object({
  data: z.array(
    z.object({
      starting_at: z.string(),
      results: z.array(
        z.object({
          model: z.string().optional(),
          uncached_input_tokens: z.number().optional(),
          input_tokens: z.number().optional(),
          output_tokens: z.number().optional(),
        }),
      ),
    }),
  ),
});

const openaiUsageSchema = z.object({
  data: z.array(
    z.object({
      start_time: z.number(),
      results: z.array(
        z.object({
          model: z.string().optional(),
          input_tokens: z.number().optional(),
          output_tokens: z.number().optional(),
          num_model_requests: z.number().optional(),
        }),
      ),
    }),
  ),
});

/** Rolls per-day/per-model rows into the result shape, applying list pricing. */
function summarise(
  provider: "anthropic" | "openai",
  days: UsageDay[],
  startDate: Date,
  endDate: Date,
): ProviderUsageResult {
  return {
    provider,
    source: "provider_api",
    days,
    totalCostUsd: Math.round(days.reduce((n, d) => n + d.costUsd, 0) * 100) / 100,
    totalInputTokens: days.reduce((n, d) => n + d.inputTokens, 0),
    totalOutputTokens: days.reduce((n, d) => n + d.outputTokens, 0),
    periodStart: day(startDate),
    periodEnd: day(endDate),
  };
}

// ── Anthropic Connector ─────────────────────────────────────────────

/**
 * Deterministic stand-in for `Math.random()` in the simulated paths.
 *
 * These used `Math.random()`, so simulated usage changed on every call and no
 * two reconciliation runs over the same period agreed. Keying off the date and
 * model keeps the spread while making the numbers stable, which is what makes
 * a demo reproducible.
 */
function seededUnit(...parts: string[]): number {
  let h = 2166136261;
  for (const c of parts.join("|")) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function seedAnthropicUsage(
  startDate: Date,
  endDate: Date,
  sourceDetail = "no provider credential configured",
): ProviderUsageResult {
  const days: UsageDay[] = [];
  const models = [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-3-5-20251001",
  ];
  const now = new Date(startDate);
  let totalCost = 0,
    totalIn = 0,
    totalOut = 0;
  while (now <= endDate) {
    for (const model of models) {
      const d = now.toISOString().slice(0, 10);
      const inputTokens = Math.floor(50_000 + seededUnit(d, model, "in") * 200_000);
      const outputTokens = Math.floor(5_000 + seededUnit(d, model, "out") * 50_000);
      // Simplified pricing: input $3/M, output $15/M (Sonnet rates)
      const rateIn = model.includes("opus") ? 15 : model.includes("haiku") ? 0.8 : 3;
      const rateOut = model.includes("opus") ? 75 : model.includes("haiku") ? 4 : 15;
      const cost = (inputTokens / 1_000_000) * rateIn + (outputTokens / 1_000_000) * rateOut;
      days.push({
        date: now.toISOString().slice(0, 10),
        model,
        inputTokens,
        outputTokens,
        costUsd: Math.round(cost * 100) / 100,
        requests: Math.floor(100 + seededUnit(d, model, "req") * 500),
      });
      totalCost += cost;
      totalIn += inputTokens;
      totalOut += outputTokens;
    }
    now.setDate(now.getDate() + 1);
  }
  return {
    provider: "anthropic",
    source: "simulated",
    sourceDetail,
    days,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    periodStart: startDate.toISOString().slice(0, 10),
    periodEnd: endDate.toISOString().slice(0, 10),
  };
}

/** List price per million tokens. Provider usage APIs report tokens, not cost. */
const ANTHROPIC_RATES: Record<string, { in: number; out: number }> = {
  "claude-opus-4": { in: 15, out: 75 },
  "claude-sonnet-4": { in: 3, out: 15 },
  "claude-haiku-4": { in: 0.8, out: 4 },
};

/** Longest-prefix match, so dated ids (claude-sonnet-4-20250514) price correctly. */
function rateFor(
  model: string,
  table: Record<string, { in: number; out: number }>,
  fallback: { in: number; out: number },
): { in: number; out: number } {
  const hit = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? table[hit]! : fallback;
}

export const anthropicConnector: ProviderConnector = {
  provider: "anthropic",
  async fetchUsage(config, startDate, endDate, fetcher: UsageFetcher = defaultFetcher) {
    const resolved = resolveProviderKey(config.apiKeyRef);
    if (resolved.key === null) {
      return seedAnthropicUsage(startDate, endDate, resolved.reason);
    }

    // Anthropic Admin API — daily usage report. Mapping is written against the
    // documented response shape and is NOT verified against a live
    // organization (this repo has no admin credential), which is why the
    // response is zod-parsed: a shape change fails here with a message rather
    // than silently reporting zero usage.
    const url =
      `https://api.anthropic.com/v1/organizations/usage_report/messages` +
      `?starting_at=${day(startDate)}&ending_at=${day(endDate)}&bucket_width=1d&group_by[]=model`;
    try {
      const res = await fetcher(url, {
        "x-api-key": resolved.key,
        "anthropic-version": "2023-06-01",
      });
      if (!res.ok) {
        return seedAnthropicUsage(startDate, endDate, `Anthropic admin API returned ${res.status}`);
      }
      const parsed = anthropicUsageSchema.parse(await res.json());
      const days: UsageDay[] = [];
      for (const bucket of parsed.data) {
        for (const row of bucket.results) {
          const model = row.model ?? "unknown";
          const inputTokens = row.uncached_input_tokens ?? row.input_tokens ?? 0;
          const outputTokens = row.output_tokens ?? 0;
          const rate = rateFor(model, ANTHROPIC_RATES, { in: 3, out: 15 });
          days.push({
            date: bucket.starting_at.slice(0, 10),
            model,
            inputTokens,
            outputTokens,
            costUsd:
              Math.round(
                ((inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out) * 100,
              ) / 100,
            // The usage report groups by model, not by request.
            requests: 0,
          });
        }
      }
      return summarise("anthropic", days, startDate, endDate);
    } catch (err) {
      return seedAnthropicUsage(
        startDate,
        endDate,
        `Anthropic admin API call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

// ── OpenAI Connector (stub) ────────────────────────────────────────────────

function seedOpenAIUsage(
  startDate: Date,
  endDate: Date,
  sourceDetail = "no provider credential configured",
): ProviderUsageResult {
  const days: UsageDay[] = [];
  const models = ["gpt-4o", "gpt-4o-mini", "o3-mini"];
  const now = new Date(startDate);
  let totalCost = 0,
    totalIn = 0,
    totalOut = 0;
  while (now <= endDate) {
    for (const model of models) {
      const d = now.toISOString().slice(0, 10);
      const inputTokens = Math.floor(30_000 + seededUnit(d, model, "in") * 150_000);
      const outputTokens = Math.floor(3_000 + seededUnit(d, model, "out") * 40_000);
      const rateIn = model === "gpt-4o-mini" ? 0.15 : model === "o3-mini" ? 0.55 : 2.5;
      const rateOut = model === "gpt-4o-mini" ? 0.6 : model === "o3-mini" ? 2.19 : 10;
      const cost = (inputTokens / 1_000_000) * rateIn + (outputTokens / 1_000_000) * rateOut;
      days.push({
        date: now.toISOString().slice(0, 10),
        model,
        inputTokens,
        outputTokens,
        costUsd: Math.round(cost * 100) / 100,
        requests: Math.floor(50 + seededUnit(d, model, "req") * 300),
      });
      totalCost += cost;
      totalIn += inputTokens;
      totalOut += outputTokens;
    }
    now.setDate(now.getDate() + 1);
  }
  return {
    provider: "openai",
    source: "simulated",
    sourceDetail,
    days,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    periodStart: startDate.toISOString().slice(0, 10),
    periodEnd: endDate.toISOString().slice(0, 10),
  };
}

const OPENAI_RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "o3-mini": { in: 0.55, out: 2.19 },
};

export const openaiConnector: ProviderConnector = {
  provider: "openai",
  async fetchUsage(config, startDate, endDate, fetcher: UsageFetcher = defaultFetcher) {
    const resolved = resolveProviderKey(config.apiKeyRef);
    if (resolved.key === null) {
      return seedOpenAIUsage(startDate, endDate, resolved.reason);
    }

    // Same caveat as the Anthropic connector: written against the documented
    // shape, zod-parsed, unverified against a live organization.
    const url =
      `https://api.openai.com/v1/organization/usage/completions` +
      `?start_time=${Math.floor(startDate.getTime() / 1000)}` +
      `&end_time=${Math.floor(endDate.getTime() / 1000)}` +
      `&bucket_width=1d&group_by[]=model&limit=31`;
    try {
      const headers: Record<string, string> = { authorization: `Bearer ${resolved.key}` };
      if (config.orgId) headers["openai-organization"] = config.orgId;
      const res = await fetcher(url, headers);
      if (!res.ok) {
        return seedOpenAIUsage(startDate, endDate, `OpenAI usage API returned ${res.status}`);
      }
      const parsed = openaiUsageSchema.parse(await res.json());
      const days: UsageDay[] = [];
      for (const bucket of parsed.data) {
        for (const row of bucket.results) {
          const model = row.model ?? "unknown";
          const inputTokens = row.input_tokens ?? 0;
          const outputTokens = row.output_tokens ?? 0;
          const rate = rateFor(model, OPENAI_RATES, { in: 2.5, out: 10 });
          days.push({
            // start_time is a unix timestamp, unlike Anthropic's ISO date.
            date: new Date(bucket.start_time * 1000).toISOString().slice(0, 10),
            model,
            inputTokens,
            outputTokens,
            costUsd:
              Math.round(
                ((inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out) * 100,
              ) / 100,
            requests: row.num_model_requests ?? 0,
          });
        }
      }
      return summarise("openai", days, startDate, endDate);
    } catch (err) {
      return seedOpenAIUsage(
        startDate,
        endDate,
        `OpenAI usage API call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

// ── Reconciliation ─────────────────────────────────────────────────────────

export interface ReconciliationResult {
  /** Provider billing-API total for the period. */
  providerTotalUsd: number;
  /** Proxy/gateway metered total for the period. */
  proxyTotalUsd: number;
  /** Drift as a percentage (abs(provider - proxy) / provider * 100). */
  driftPct: number;
  /** Reconciliation status. */
  status: "ok" | "drift_warning" | "drift_critical" | "missing_data" | "not_comparable";
  /** Human-readable summary. */
  message: string;
  /** Per-model breakdown. */
  byModel: { model: string; providerUsd: number; proxyUsd: number; driftPct: number }[];
}

/**
 * Reconciles provider billing-API totals against proxy/gateway metering.
 * Spec §7.3: alerts on drift > 5%.
 *
 * @param providerResult - Data from provider admin API.
 * @param proxyTotal  - Total cost from the ARM proxy/gateway metering.
 * @param proxyByModel - Per-model cost from the proxy/gateway.
 */
export function reconcile(
  providerResult: ProviderUsageResult,
  proxyTotal: number,
  proxyByModel: Record<string, number>,
): ReconciliationResult {
  // Drift against simulated provider data is not a measurement — it is the
  // difference between real metering and made-up numbers, reported to one
  // decimal place as though it meant something. Refuse it.
  if (providerResult.source === "simulated") {
    return {
      providerTotalUsd: Math.round(providerResult.totalCostUsd * 100) / 100,
      proxyTotalUsd: Math.round(proxyTotal * 100) / 100,
      driftPct: 0,
      status: "not_comparable",
      message:
        `Provider usage is simulated (${providerResult.sourceDetail ?? "no credential"}), ` +
        `so drift cannot be computed. Configure the provider admin API key to reconcile.`,
      byModel: [],
    };
  }

  const providerTotal = providerResult.totalCostUsd;
  const driftPct =
    providerTotal > 0
      ? (Math.abs(providerTotal - proxyTotal) / providerTotal) * 100
      : proxyTotal > 0
        ? 100
        : 0;

  const status: ReconciliationResult["status"] =
    providerTotal === 0 && proxyTotal === 0
      ? "missing_data"
      : driftPct > 10
        ? "drift_critical"
        : driftPct > 5
          ? "drift_warning"
          : "ok";

  // Per-model drift
  const providerByModel: Record<string, number> = {};
  for (const day of providerResult.days) {
    providerByModel[day.model] = (providerByModel[day.model] ?? 0) + day.costUsd;
  }

  const allModels = new Set([...Object.keys(providerByModel), ...Object.keys(proxyByModel)]);
  const byModel = [...allModels]
    .map((model) => {
      const pCost = providerByModel[model] ?? 0;
      const xCost = proxyByModel[model] ?? 0;
      return {
        model,
        providerUsd: Math.round(pCost * 100) / 100,
        proxyUsd: Math.round(xCost * 100) / 100,
        driftPct: pCost > 0 ? Math.round((Math.abs(pCost - xCost) / pCost) * 100 * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.driftPct - a.driftPct);

  return {
    providerTotalUsd: Math.round(providerTotal * 100) / 100,
    proxyTotalUsd: Math.round(proxyTotal * 100) / 100,
    driftPct: Math.round(driftPct * 10) / 10,
    status,
    message:
      status === "missing_data"
        ? "No data from either source — billing pipeline may be down."
        : status === "drift_critical"
          ? `Critical drift: ${driftPct.toFixed(1)}% difference between provider bill and proxy metering.`
          : status === "drift_warning"
            ? `Warning: ${driftPct.toFixed(1)}% drift — investigate before period close.`
            : `Reconciled within tolerance (${driftPct.toFixed(1)}% drift).`,
    byModel,
  };
}
