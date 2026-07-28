"use client";

import { useState } from "react";
import { trpc } from "../lib/trpc/client";

export function SavingsEstimator() {
  const { data, isLoading } = trpc.spend.savingsEstimate.useQuery({ scope: null });
  const [switched, setSwitched] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-4 text-sm font-semibold">Savings Estimator</h3>
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Savings Opportunity</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
          {data.scope.name}
        </span>
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        Switch {data.impactedAgents} agents from closed models to open models (GLM-5.2, DeepSeek V3) and save
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-emerald-600">
          ${data.potentialSavings.toLocaleString()}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>/mo</span>
        <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
          -{data.savingsPct}%
        </span>
      </div>

      {/* Before vs After bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: "var(--text-muted)" }}>Current</span>
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>${data.currentMonthlySpend.toLocaleString()}/mo</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <div className="h-full w-full rounded-full" style={{ backgroundColor: "var(--warning)" }} />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: "var(--text-muted)" }}>After switch</span>
          <span className="font-semibold text-emerald-600">${data.openModelMonthlyEstimate.toLocaleString()}/mo</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.round((data.openModelMonthlyEstimate / data.currentMonthlySpend) * 100)}%` }}
          />
        </div>
      </div>

      {!switched ? (
        <button
          onClick={() => setSwitched(true)}
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Simulate Switch to Open Models
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700">
          ✓ Simulated — policy update logged. Impact preview: ${data.potentialSavings.toLocaleString()}/mo saved across {data.impactedAgents} agents.
        </div>
      )}
    </div>
  );
}
