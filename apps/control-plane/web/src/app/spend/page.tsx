"use client";

/**
 * Spend Analysis (docs/guides/02-server-panels.md §1: "$/spend keeps all
 * content, loses its Platform-level position. Reframe the primary chart
 * from 'closed vs self-hosted' to cost per active seat and cost per work
 * product; keep the closed-vs-open split as a secondary panel (A1: on-prem
 * is nice-to-have, so it is reported, not campaigned for).").
 *
 * "Cost per active seat" reads `adoption.activeUsers` (this PR's own
 * router) — cost is now expressed against the adoption metric that A1
 * makes primary, not against raw model spend.
 */

import { Suspense } from "react";
import { StatCard } from "../../components/stat-card";
import { SpendTrendChart, ModelSpendChart } from "../../components/charts";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { SpendTreemap } from "../../components/spend-tree";
import { WorkClassificationPanel } from "../../components/work-classification";
import { HostingCost } from "../../components/hosting-cost";
import { SampleDataBadge } from "../../components/deferred-shell";
import { SAMPLE_COST_PER_WORK_PRODUCT } from "../../lib/governance-fixtures";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";

export default function SpendPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />}>
      <SpendPageContent />
    </Suspense>
  );
}

function SpendPageContent() {
  const scope = useScope();
  const summary = trpc.spend.summary.useQuery({ scope });
  const trend = trpc.spend.trend.useQuery({ scope });
  const byModel = trpc.spend.byModel.useQuery({ scope });
  const active = trpc.adoption.activeUsers.useQuery({ scope });

  const s = summary.data;
  const totalClosed = byModel.data?.models.filter((m) => m.kind === "closed").reduce((n, m) => n + m.spend, 0) ?? 0;
  const totalSelfHosted = byModel.data?.models.filter((m) => m.kind === "self_hosted").reduce((n, m) => n + m.spend, 0) ?? 0;
  const costPerActiveSeat = s && active.data && active.data.weeklyActive > 0 ? s.totalMonthlySpend / active.data.weeklyActive : null;

  return (
    <div className="space-y-6">
      <div>
        <ScopeBreadcrumb scope={scope} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Spend Analysis</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Cost per active seat &amp; cost per work product — secondary to adoption (A1); model-mix breakdown is reported, not campaigned for
        </p>
      </div>

      {s ? (
        <>
          {/* PRIMARY: cost per active seat + cost per work product (guide 02 §1) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="inst-card p-5">
              <h2 className="label-meta mb-1">Cost per Active Seat</h2>
              <p className="mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>total monthly spend ÷ weekly-active seats (adoption.activeUsers)</p>
              <div className="text-[32px] font-semibold tabular" style={{ color: "var(--navy)" }}>
                {costPerActiveSeat != null ? `$${costPerActiveSeat.toFixed(0)}` : "—"}
                <span className="ml-1 text-[14px] font-normal" style={{ color: "var(--text-muted)" }}>/mo</span>
              </div>
              <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                ${s.totalMonthlySpend.toLocaleString()}/mo ÷ {active.data?.weeklyActive ?? "—"} weekly-active seats
              </div>
            </div>

            <div className="inst-card p-5">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="label-meta">Cost per Work Product</h2>
                <SampleDataBadge />
              </div>
              <p className="mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>full detail on /governance</p>
              <div className="space-y-2">
                {SAMPLE_COST_PER_WORK_PRODUCT.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: "var(--text-secondary)" }}>{c.workProduct}</span>
                    <span className="tabular font-semibold" style={{ color: "var(--text-primary)" }}>${c.effectiveUsd}</span>
                  </div>
                ))}
              </div>
              <a href="/governance" className="mt-3 inline-block text-[11px] font-medium" style={{ color: "var(--navy)" }}>
                View governance detail →
              </a>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Monthly" value={`$${s.totalMonthlySpend.toLocaleString()}`} sub={`Budget: $${s.budgetCap.toLocaleString()} · ${s.agentCount} agents`} />
            <StatCard label="Budget Used" value={`${s.budgetUtilPct}%`} sub={s.budgetUtilPct > 80 ? "Over threshold" : "Healthy"} tone={s.budgetUtilPct > 80 ? "danger" : "success"} />
            <StatCard label="Closed Models" value={`$${totalClosed.toLocaleString()}`} sub="Anthropic + OpenAI" tone="warning" />
            <StatCard label="Self-Hosted" value={`$${totalSelfHosted.toLocaleString()}`} sub="GLM + DeepSeek · lower cost" tone="success" />
          </div>

          {/* Trend + model breakdown — SECONDARY (guide 02 §1: reported, not campaigned for) */}
          <div>
            <h2 className="label-meta mb-3">Model Mix — Secondary (on-prem is tracked, not targeted)</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {trend.data && <SpendTrendChart data={trend.data.points} />}
              {byModel.data && <ModelSpendChart data={byModel.data.models} />}
            </div>
          </div>

          {/* Hierarchical spend treemap (vivid management view) */}
          <SpendTreemap />

          {/* Work-type classification — what agents DO */}
          <WorkClassificationPanel />

          {/* Hosting cost model for self-hosted inference */}
          <HostingCost />
        </>
      ) : (
        <div className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />
      )}
    </div>
  );
}
