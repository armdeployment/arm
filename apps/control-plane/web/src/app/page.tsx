"use client";

import { StatCard } from "../components/stat-card";
import { SpendTrendChart, ModelSpendChart, TierBreakdownChart } from "../components/charts";
import { AgentsTable } from "../components/agents-table";
import { trpc } from "../lib/trpc/client";

export default function DashboardPage() {
  const summary = trpc.spend.summary.useQuery();
  const trend = trpc.spend.trend.useQuery();
  const byModel = trpc.spend.byModel.useQuery();
  const agents = trpc.agents.list.useQuery({ status: "all" });

  if (summary.isLoading || !summary.data) return <DashboardSkeleton />;

  const s = summary.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live via tRPC · {s.tenantId}
          </span>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Identity, metering, budgeting &amp; access governance for AI agents
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Spend" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub="↑ 8.2% vs last month" tone="warning" />
        <StatCard label="Active Agents" value={String(s.agentCount)} sub={`${s.tierBreakdown[0]!.count} critical · ${s.tierBreakdown[1]!.count} standard · ${s.tierBreakdown[2]!.count} background`} />
        <StatCard label="Proxied Traffic" value={`${s.proxiedTrafficPct}%`} sub="Target ≥ 80% — adoption healthy" tone="success" />
        <StatCard label="Budget Utilization" value={`${s.budgetUtilizationPct}%`} sub={`${s.pendingApprovals} pending approvals`} tone={s.budgetUtilizationPct > 80 ? "danger" : "default"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">{trend.data && <SpendTrendChart data={trend.data.points} />}</div>
        <TierBreakdownChart data={s.tierBreakdown} />
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byModel.data && <ModelSpendChart data={byModel.data.models} />}
        {agents.data && <AgentsTable data={agents.data.agents} />}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
        ))}
      </div>
    </div>
  );
}
