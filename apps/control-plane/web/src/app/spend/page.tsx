"use client";

import { Suspense } from "react";
import { StatCard } from "../../components/stat-card";
import { SpendTrendChart, ModelSpendChart } from "../../components/charts";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { ChildScopeGrid } from "../../components/child-scope-grid";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";

export default function SpendPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />}>
      <SpendPageContent />
    </Suspense>
  );
}

function SpendPageContent() {
  const scope = useScope();
  const summary = trpc.spend.summary.useQuery({ scope });
  const trend = trpc.spend.trend.useQuery({ scope });
  const byModel = trpc.spend.byModel.useQuery({ scope });
  const children = trpc.orgTree.children.useQuery({ scope });

  const s = summary.data;
  const totalClosed = byModel.data?.models.filter((m) => m.kind === "closed").reduce((n, m) => n + m.spend, 0) ?? 0;
  const totalSelfHosted = byModel.data?.models.filter((m) => m.kind === "self_hosted").reduce((n, m) => n + m.spend, 0) ?? 0;
  const hasChildren = children.data ? children.data.children.length > 0 : false;

  return (
    <div className="space-y-6">
      <div>
        <ScopeBreadcrumb scope={scope} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Spend</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          LLM metering, cost attribution, and savings opportunities (spec §7)
        </p>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Monthly" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub={`Budget cap: $${s.budgetCap.toLocaleString()}`} />
            <StatCard label="Budget Used" value={`${s.budgetUtilPct}%`} sub={s.budgetUtilPct > 80 ? "Over threshold" : "Healthy"} tone={s.budgetUtilPct > 80 ? "danger" : "success"} />
            <StatCard label="Closed Models" value={`$${totalClosed.toLocaleString()}`} sub="Anthropic + OpenAI" tone="warning" />
            <StatCard label="Self-Hosted" value={`$${totalSelfHosted.toLocaleString()}`} sub="GLM + DeepSeek" tone="success" />
          </div>

          {hasChildren && <ChildScopeGrid scope={scope} />}
          {trend.data && <SpendTrendChart data={trend.data.points} />}
          {byModel.data && <ModelSpendChart data={byModel.data.models} />}
        </>
      ) : (
        <div className="h-64 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
      )}
    </div>
  );
}
