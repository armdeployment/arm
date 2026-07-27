"use client";

import { trpc } from "../lib/trpc/client";
import { scopeUrl, type ScopeRef } from "../lib/use-scope";

interface ChildScopeGridProps {
  scope: ScopeRef;
}

const TYPE_LABELS: Record<string, string> = {
  department: "Departments",
  group: "Groups",
  team: "Teams",
  workstream: "Workstreams",
};

export function ChildScopeGrid({ scope }: ChildScopeGridProps) {
  const { data, isLoading } = trpc.orgTree.children.useQuery({ scope });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
        ))}
      </div>
    );
  }

  if (data.children.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {TYPE_LABELS[data.children[0]!.type] ?? "Sub-scopes"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.children.map((child) => (
          <a
            key={child.id}
            href={scopeUrl({ type: child.type, id: child.id })}
            className="group rounded-2xl border p-5 transition-all hover:shadow-md hover:border-blue-300"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-surface)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {child.name}
                </div>
                <div className="mt-0.5 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                  {child.type}
                </div>
              </div>
              {child.criticalCount > 0 && (
                <span
                  className="flex h-6 items-center rounded-full px-2 text-[10px] font-bold text-white"
                  style={{ backgroundColor: "var(--tier-critical)" }}
                >
                  {child.criticalCount} CRIT
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                ${child.monthlySpend.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}> / mo</span>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>{child.agentCount} agents</span>
              <span>·</span>
              <span style={{ color: child.budgetUtilPct > 80 ? "var(--danger)" : "var(--text-secondary)" }}>
                {child.budgetUtilPct}% budget
              </span>
            </div>

            {/* Budget bar */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(child.budgetUtilPct, 100)}%`,
                  backgroundColor: child.budgetUtilPct > 80 ? "var(--danger)" : child.budgetUtilPct > 60 ? "var(--warning)" : "var(--accent)",
                }}
              />
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--accent)" }}>
              Drill in →
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
