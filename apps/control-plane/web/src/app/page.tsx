import { StatCard } from "../components/stat-card";
import { SpendTrendChart, ModelSpendChart, TierBreakdown } from "../components/charts";
import { AgentsTable } from "../components/agents-table";
import { summary } from "../lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Agent Resource Management — identity, metering, budgeting &amp; access governance
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Spend"
          value={`$${summary.totalMonthlySpend.toLocaleString()}`}
          sub="↑ 8.2% vs last month"
          tone="warning"
        />
        <StatCard
          label="Active Agents"
          value={String(summary.agentCount)}
          sub="4 critical · 31 standard · 12 background"
        />
        <StatCard
          label="Proxied Traffic"
          value={`${summary.proxiedTrafficPct}%`}
          sub="Target ≥ 80% — adoption healthy"
          tone="success"
        />
        <StatCard
          label="Budget Utilization"
          value={`${summary.budgetUtilizationPct}%`}
          sub={`${summary.pendingApprovals} pending approvals`}
          tone={summary.budgetUtilizationPct > 80 ? "danger" : "default"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendTrendChart />
        </div>
        <TierBreakdown />
      </div>

      {/* Lower row: model spend + agents table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModelSpendChart />
        <AgentsTable />
      </div>
    </div>
  );
}
