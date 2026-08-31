"use client";

import { trpc } from "../lib/trpc/client";
import { scopeUrl } from "../lib/use-scope";

const CLEARANCE_STYLES: Record<string, string> = {
  public: "border border-[var(--border)] text-[var(--success)] ring-1 ring-green-200",
  internal: "bg-blue-50 text-[var(--accent)] ring-1 ring-blue-200",
  confidential: "border border-[var(--border)] text-[var(--warning)] ring-1 ring-amber-200",
  restricted: "bg-rose-50 text-[var(--danger)] ring-1 ring-rose-200",
};

const CLEARANCE_DESC: Record<string, string> = {
  public: "Unrestricted — can route to any model",
  internal: "Internal use — gated from external models",
  confidential: "Confidential — self-hosted models only",
  restricted: "Restricted — highest sensitivity, audited access",
};

export function WorkClassificationPanel() {
  const { data, isLoading } = trpc.orgTree.workTypes.useQuery({ scope: null });

  if (isLoading || !data) {
    return (
      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold">Work Classification by Department</h3>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Classification clearance summary */}
      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Work Classification Across All Departments
          </h3>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {data.agentCount} agents · ${data.totalSpend.toLocaleString()}/mo
          </span>
        </div>

        {/* Clearance breakdown */}
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(CLEARANCE_STYLES).map(([clearance, style]) => {
            const entry = data.classificationBreakdown.find((c) => c.clearance === clearance);
            if (!entry || entry.count === 0) return null;
            return (
              <div
                key={clearance}
                className="flex flex-1 flex-col items-center rounded-md border p-3"
                style={{ borderColor: "var(--border)", minWidth: 100 }}
              >
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${style}`}>
                  {clearance}
                </span>
                <span
                  className="mt-1.5 text-lg font-bold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {entry.count}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  agents
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Work types by department — what agents actually DO */}
      <div
        className="rounded-lg border"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            What Agents Do — Work Types
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {data.workTypes.slice(0, 15).map((wt) => (
            <div key={wt.category} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {wt.category.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-medium capitalize"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wt.category}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {wt.agentCount} agent{wt.agentCount !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-sm font-bold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  ${wt.spend.toLocaleString()}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  /mo
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
