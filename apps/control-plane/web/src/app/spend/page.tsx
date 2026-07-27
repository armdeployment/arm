"use client";

import { StatCard } from "../../components/stat-card";
import { SpendTrendChart, ModelSpendChart } from "../../components/charts";
import { trpc } from "../../lib/trpc/client";

export default function SpendPage() {
  const summary = trpc.spend.summary.useQuery();
  const trend = trpc.spend.trend.useQuery();
  const byModel = trpc.spend.byModel.useQuery();

  const s = summary.data;
  const totalClosed = byModel.data?.models.filter((m) => m.kind === "closed").reduce((n, m) => n + m.spend, 0) ?? 0;
  const totalSelfHosted = byModel.data?.models.filter((m) => m.kind === "self_hosted").reduce((n, m) => n + m.spend, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Spend</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          LLM metering, cost attribution, and savings opportunities (spec §7)
        </p>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Monthly" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub="All providers" />
            <StatCard label="Closed Models" value={`$${totalClosed.toLocaleString()}`} sub="Anthropic + OpenAI" tone="warning" />
            <StatCard label="Self-Hosted" value={`$${totalSelfHosted.toLocaleString()}`} sub="GLM + DeepSeek" tone="success" />
            <StatCard label="Savings Opportunity" value={`$${Math.round(totalClosed * 0.4).toLocaleString()}`} sub="Est. 40% if migrated to open models" tone="success" />
          </div>
          {trend.data && <SpendTrendChart data={trend.data.points} />}
          {byModel.data && <ModelSpendChart data={byModel.data.models} />}
        </>
      ) : (
        <div className="h-64 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
      )}
    </div>
  );
}
