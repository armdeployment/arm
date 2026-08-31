/**
 * ARM Billing package (spec §7, §9 1.1).
 *
 * LLM provider billing-API connectors for daily usage aggregation, cost attribution,
 * and reconciliation. Each connector implements the ProviderConnector interface.
 *
 * Layer 2 (AGENTS.md DAG): may import proto/config only.
 * Real API keys come from config; callers wire them through the connector.
 *
 * TODO(1.1): wire real Anthropic/OpenAI admin API when credentials are available.
 * Currently returns seeded fixture data matching the manufacturing org tree.
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
  ): Promise<ProviderUsageResult>;
}

// ── Anthropic Connector (stub) ─────────────────────────────────────────────

function seedAnthropicUsage(startDate: Date, endDate: Date): ProviderUsageResult {
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
      const inputTokens = Math.floor(50_000 + Math.random() * 200_000);
      const outputTokens = Math.floor(5_000 + Math.random() * 50_000);
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
        requests: Math.floor(100 + Math.random() * 500),
      });
      totalCost += cost;
      totalIn += inputTokens;
      totalOut += outputTokens;
    }
    now.setDate(now.getDate() + 1);
  }
  return {
    provider: "anthropic",
    days,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    periodStart: startDate.toISOString().slice(0, 10),
    periodEnd: endDate.toISOString().slice(0, 10),
  };
}

export const anthropicConnector: ProviderConnector = {
  provider: "anthropic",
  async fetchUsage(_config, startDate, endDate) {
    // TODO(1.1): Replace with real Anthropic Admin API call when credentials available.
    // POST https://api.anthropic.com/v1/organizations/{org_id}/usage with apiKeyRef
    // Map response to ProviderUsageResult.
    return seedAnthropicUsage(startDate, endDate);
  },
};

// ── OpenAI Connector (stub) ────────────────────────────────────────────────

function seedOpenAIUsage(startDate: Date, endDate: Date): ProviderUsageResult {
  const days: UsageDay[] = [];
  const models = ["gpt-4o", "gpt-4o-mini", "o3-mini"];
  const now = new Date(startDate);
  let totalCost = 0,
    totalIn = 0,
    totalOut = 0;
  while (now <= endDate) {
    for (const model of models) {
      const inputTokens = Math.floor(30_000 + Math.random() * 150_000);
      const outputTokens = Math.floor(3_000 + Math.random() * 40_000);
      const rateIn = model === "gpt-4o-mini" ? 0.15 : model === "o3-mini" ? 0.55 : 2.5;
      const rateOut = model === "gpt-4o-mini" ? 0.6 : model === "o3-mini" ? 2.19 : 10;
      const cost = (inputTokens / 1_000_000) * rateIn + (outputTokens / 1_000_000) * rateOut;
      days.push({
        date: now.toISOString().slice(0, 10),
        model,
        inputTokens,
        outputTokens,
        costUsd: Math.round(cost * 100) / 100,
        requests: Math.floor(50 + Math.random() * 300),
      });
      totalCost += cost;
      totalIn += inputTokens;
      totalOut += outputTokens;
    }
    now.setDate(now.getDate() + 1);
  }
  return {
    provider: "openai",
    days,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    periodStart: startDate.toISOString().slice(0, 10),
    periodEnd: endDate.toISOString().slice(0, 10),
  };
}

export const openaiConnector: ProviderConnector = {
  provider: "openai",
  async fetchUsage(_config, startDate, endDate) {
    // TODO(1.1): Replace with real OpenAI Admin API call.
    return seedOpenAIUsage(startDate, endDate);
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
  status: "ok" | "drift_warning" | "drift_critical" | "missing_data";
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
