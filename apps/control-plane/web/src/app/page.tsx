"use client";

import { Suspense } from "react";
import { StatCard } from "../components/stat-card";
import { SpendTrendChart, TierBreakdownChart } from "../components/charts";
import { AgentsTable } from "../components/agents-table";
import { ScopeBreadcrumb } from "../components/breadcrumb";
import { SavingsEstimator } from "../components/savings-estimator";
import { NotificationCenter } from "../components/notification-center";
import { ModelPolicyPanel } from "../components/model-policy";
import { ChildScopeGrid } from "../components/child-scope-grid";
import { useScope } from "../lib/use-scope";
import { trpc } from "../lib/trpc/client";
import type { AgentRow } from "../lib/mock-data";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const scope = useScope();
  const summary = trpc.spend.summary.useQuery({ scope });
  const trend = trpc.spend.trend.useQuery({ scope });
  const agents = trpc.agents.list.useQuery({ scope, status: "all" });
  const children = trpc.orgTree.children.useQuery({ scope });

  if (summary.isLoading || !summary.data) return <DashboardSkeleton />;

  const s = summary.data;
  const hasChildren = children.data ? children.data.children.length > 0 : false;

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div>
        <ScopeBreadcrumb scope={scope} />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{s.scope.name}</h1>
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium capitalize text-blue-600">
            {s.scope.type}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live via tRPC · {s.tenantId}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Spend" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub={`Budget: $${s.budgetCap.toLocaleString()}`} tone={s.budgetUtilPct > 80 ? "danger" : s.budgetUtilPct > 60 ? "warning" : "default"} />
        <StatCard label="Active Agents" value={String(s.agentCount)} sub={`${s.tierBreakdown[0]!.count} critical · ${s.tierBreakdown[1]!.count} standard · ${s.tierBreakdown[2]!.count} background`} />
        <StatCard label="Budget Used" value={`${s.budgetUtilPct}%`} sub={s.budgetUtilPct > 80 ? "Over threshold" : "Healthy"} tone={s.budgetUtilPct > 80 ? "danger" : "success"} />
        <StatCard label="Proxied Traffic" value={`${s.proxiedTrafficPct}%`} sub="Target ≥ 80%" tone="success" />
      </div>

      {/* Drill-down: child scope cards (primary navigation) */}
      {hasChildren && <ChildScopeGrid scope={scope} />}

      {/* Charts: trend + tier breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">{trend.data && <SpendTrendChart data={trend.data.points} />}</div>
        <TierBreakdownChart data={s.tierBreakdown} />
      </div>

      {/* Top agents (top 5 only on dashboard) */}
      {agents.data && agents.data.agents.length > 0 && (
        <AgentsTable data={(agents.data.agents as AgentRow[]).slice(0, 5)} />
      )}

      {/* Savings estimator + model policy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SavingsEstimator />
        <ModelPolicyPanel />
      </div>

      {/* Notifications */}
      <NotificationCenter />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
        ))}
      </div>
    </div>
  );
}
