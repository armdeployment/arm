"use client";

import { Suspense } from "react";
import { StatCard } from "../../components/stat-card";
import { SpendTrendChart, ModelSpendChart } from "../../components/charts";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { SpendTreemap } from "../../components/spend-tree";
import { WorkClassificationPanel } from "../../components/work-classification";
import { HostingCost } from "../../components/hosting-cost";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";

export default function SpendPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />}>
      <SpendPageContent />
    </Suspense>
  );
}

function SpendPageContent() {
  const scope = useScope();
  const summary = trpc.spend.summary.useQuery({ scope });
  const trend = trpc.spend.trend.useQuery({ scope });
  const byModel = trpc.spend.byModel.useQuery({ scope });

  const s = summary.data;
  const totalClosed = byModel.data?.models.filter((m) => m.kind === "closed").reduce((n, m) => n + m.spend, 0) ?? 0;
  const totalSelfHosted = byModel.data?.models.filter((m) => m.kind === "self_hosted").reduce((n, m) => n + m.spend, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <ScopeBreadcrumb scope={scope} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Spend Analysis</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          LLM metering, cost attribution, model mix &amp; savings opportunities (spec §7)
        </p>
      </div>

      {s ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Monthly" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub={`Budget: $${s.budgetCap.toLocaleString()} · ${s.agentCount} agents`} />
            <StatCard label="Budget Used" value={`${s.budgetUtilPct}%`} sub={s.budgetUtilPct > 80 ? "Over threshold" : "Healthy"} tone={s.budgetUtilPct > 80 ? "danger" : "success"} />
            <StatCard label="Closed Models" value={`$${totalClosed.toLocaleString()}`} sub="Anthropic + OpenAI" tone="warning" />
            <StatCard label="Self-Hosted" value={`$${totalSelfHosted.toLocaleString()}`} sub="GLM + DeepSeek · lower cost" tone="success" />
          </div>

          {/* Trend + Model breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {trend.data && <SpendTrendChart data={trend.data.points} />}
            {byModel.data && <ModelSpendChart data={byModel.data.models} />}
          </div>

          {/* Hierarchical spend treemap (vivid management view) */}
          <SpendTreemap />

          {/* Work-type classification — what agents DO */}
          <WorkClassificationPanel />

          {/* Hosting cost model for self-hosted inference */}
          <HostingCost />
        </>
      ) : (
        <div className="h-64 animate-pulse rounded-2xl border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />
      )}
    </div>
  );
}
