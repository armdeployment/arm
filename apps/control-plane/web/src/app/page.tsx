"use client";

/**
 * Role home (docs/guides/02-server-panels.md §1): "top row is adoption +
 * approvals; spend becomes a single strip, not the headline."
 *
 * A1 (locked assumption): agent adoption at scale is the PRIMARY value
 * prop, cost is secondary. This page now leads with the activation funnel
 * + weekly-active headline and the two approval queues (package
 * assignments, JIT access) — spend drops to a single condensed stat-card
 * strip beneath them, and the old two-chart spend section (trend + tier
 * breakdown) moves further down, below the adoption content.
 *
 * NOTE — persona-based homes (guide 02 §1: "Each persona keeps its own
 * home (spec §5.3) — exec and admin land on adoption, InfoSec still lands
 * on audit"): this dev-mode build has no real auth/session persona to
 * branch on (the tRPC route handler hardcodes one dev claims object —
 * apps/control-plane/web/src/app/api/trpc/[trpc]/route.ts — until real
 * OIDC lands). Implementing persona routing here would mean inventing a
 * fake persona switcher rather than wiring real session data, so this is
 * left as a tracked gap (flagged in the PR description) rather than
 * fabricated. The single home below leads with adoption for everyone,
 * which satisfies the exec/admin default at least.
 */

import { Suspense } from "react";
import { StatCard } from "../components/stat-card";
import { SpendTrendChart, TierBreakdownChart } from "../components/charts";
import { AgentsTable } from "../components/agents-table";
import { ScopeBreadcrumb } from "../components/breadcrumb";
import { SavingsEstimator } from "../components/savings-estimator";
import { NotificationCenter } from "../components/notification-center";
import { ModelPolicyPanel } from "../components/model-policy";
import { SecurityFlags } from "../components/security-flags";
import { GPUBrokeringPanel } from "../components/gpu-brokering";
import { AnomalyPanel } from "../components/anomaly-panel";
import { HostingCost } from "../components/hosting-cost";
import { LiveTicker } from "../components/live-ticker";
import { ChildScopeGrid } from "../components/child-scope-grid";
import { FunnelPanel } from "../components/adoption/funnel-panel";
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
  const active = trpc.adoption.activeUsers.useQuery({ scope });
  const packageApprovals = trpc.catalog.listAssignments.useQuery();
  const accessApprovals = trpc.access.pendingApprovals.useQuery({ scope });

  if (summary.isLoading || !summary.data) return <DashboardSkeleton />;

  const s = summary.data;
  const hasChildren = children.data ? children.data.children.length > 0 : false;
  const pendingPackageApprovals =
    packageApprovals.data?.assignments.filter((a) => a.status === "requested").length ?? 0;
  const pendingAccessApprovals = accessApprovals.data?.requests.length ?? 0;

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div>
        <ScopeBreadcrumb scope={scope} />
        <div className="mt-1.5 flex items-center gap-2.5">
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {s.scope.name}
          </h1>
          <span
            className="label-meta px-2 py-0.5 capitalize"
            style={{
              backgroundColor: "var(--navy-light)",
              color: "var(--navy)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {s.scope.type}
          </span>
        </div>
        <div
          className="mt-1 flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="status-dot live" />
          Live · {s.tenantId}
        </div>
      </div>

      {/* ── TOP ROW: Adoption + Approvals (guide 02 §1, A1 primary) ────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FunnelPanel scope={scope} />
        </div>
        <div className="space-y-4">
          <StatCard
            label="Weekly Active"
            value={active.data ? String(active.data.weeklyActive) : "—"}
            sub="A1 primary metric"
            tone="success"
          />
          <a href="/governance" className="block">
            <StatCard
              label="Package Approvals"
              value={String(pendingPackageApprovals)}
              sub="pending in Governance"
              tone={pendingPackageApprovals > 0 ? "warning" : "default"}
            />
          </a>
          <a href="/access" className="block">
            <StatCard
              label="Access Approvals"
              value={String(pendingAccessApprovals)}
              sub="pending JIT requests"
              tone={pendingAccessApprovals > 0 ? "warning" : "default"}
            />
          </a>
        </div>
      </div>

      {/* Live ticker — polling-driven realtime snapshot */}
      <LiveTicker />

      {/* Drill-down: child scope cards (primary navigation) */}
      {hasChildren && <ChildScopeGrid scope={scope} />}

      {/* ── Spend — single condensed strip, not the headline (guide 02 §1) ── */}
      <div>
        <h2 className="label-meta mb-3">Spend — secondary to adoption (A1)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Monthly Spend"
            value={`$${s.totalMonthlySpend.toLocaleString()}`}
            sub={`Budget: $${s.budgetCap.toLocaleString()}`}
            tone={s.budgetUtilPct > 80 ? "danger" : s.budgetUtilPct > 60 ? "warning" : "default"}
          />
          <StatCard
            label="Active Agents"
            value={String(s.agentCount)}
            sub={`${s.tierBreakdown[0]!.count} critical · ${s.tierBreakdown[1]!.count} standard · ${s.tierBreakdown[2]!.count} background`}
          />
          <StatCard
            label="Budget Used"
            value={`${s.budgetUtilPct}%`}
            sub={s.budgetUtilPct > 80 ? "Over threshold" : "Healthy"}
            tone={s.budgetUtilPct > 80 ? "danger" : "success"}
          />
          <StatCard
            label="Proxied Traffic"
            value={`${s.proxiedTrafficPct}%`}
            sub="Target ≥ 80%"
            tone="success"
          />
        </div>
      </div>

      {/* Top agents (top 5 only on dashboard) */}
      {agents.data && agents.data.agents.length > 0 && (
        <AgentsTable data={(agents.data.agents as AgentRow[]).slice(0, 5)} />
      )}

      {/* Charts: trend + tier breakdown — de-emphasized detail, not the lead */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {trend.data && <SpendTrendChart data={trend.data.points} />}
        </div>
        <TierBreakdownChart data={s.tierBreakdown} />
      </div>

      {/* Savings estimator + model policy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SavingsEstimator />
        <ModelPolicyPanel />
      </div>

      {/* Notifications + Security Flags */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NotificationCenter />
        <SecurityFlags />
      </div>

      {/* GPU Brokering + Anomaly Detection */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GPUBrokeringPanel />
        <AnomalyPanel />
      </div>

      {/* Hosting cost — nice-to-have detail (A1: on-prem is tracked, not targeted) */}
      <HostingCost />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div
        className="h-4 w-32 animate-pulse rounded"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
          />
        ))}
      </div>
    </div>
  );
}
