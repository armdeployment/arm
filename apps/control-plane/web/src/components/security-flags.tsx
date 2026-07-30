"use client";

import { trpc } from "../lib/trpc/client";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border border-[var(--border)] text-[var(--danger)] ring-1 ring-red-200",
  warning: "border border-[var(--border)] text-[var(--warning)] ring-1 ring-amber-200",
  info: "bg-blue-50 text-[var(--accent)] ring-1 ring-blue-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  model_violation: "Model Violation",
  data_access: "Data Access",
  budget_breach: "Budget Breach",
  permission_escalation: "Permission Escalation",
  unusual_pattern: "Unusual Pattern",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-red-100 text-[var(--danger)]",
  acknowledged: "bg-amber-100 text-[var(--warning)]",
  reviewed: "bg-green-100 text-[var(--success)]",
};

export function SecurityFlags() {
  const { data, isLoading } = trpc.security.flags.useQuery({ scope: null });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-4 text-sm font-semibold">Security Flags</h3>
        <div className="h-32 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  const criticalCount = data.flags.filter((f) => f.severity === "critical").length;

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Security Flags</h3>
          {criticalCount > 0 && (
            <span className="flex h-5 items-center rounded-full bg-red-600 px-2 text-[10px] font-bold text-white">
              {criticalCount} critical
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data.flags.length} flagged operations
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {data.flags.map((flag) => (
          <div key={flag.id} className="flex items-start gap-3 px-5 py-3">
            {/* Severity dot */}
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  flag.severity === "critical" ? "#dc2626" : flag.severity === "warning" ? "#d97706" : "#2563eb",
              }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_STYLES[flag.severity] ?? ""}`}>
                  {CATEGORY_LABELS[flag.category] ?? flag.category}
                </span>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {flag.scope}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {flag.description}
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  {flag.agentName} · {new Date(flag.timestamp).toLocaleDateString()}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize ${STATUS_STYLES[flag.status] ?? ""}`}>
                  {flag.status}
                </span>
              </div>
            </div>

            {/* Severity label */}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${SEVERITY_STYLES[flag.severity] ?? ""}`}>
              {flag.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
