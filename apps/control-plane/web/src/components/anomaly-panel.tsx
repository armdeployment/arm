"use client";

import { trpc } from "../lib/trpc/client";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-600 ring-1 ring-red-200",
  warning: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
  info: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  reviewing: "bg-amber-100 text-amber-700",
  acknowledged: "bg-blue-100 text-blue-700",
};

export function AnomalyPanel() {
  const { data, isLoading } = trpc.anomaly.scan.useQuery();

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-4 text-sm font-semibold">Anomaly Detection</h3>
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Anomaly Detection</h3>
          {data.summary.critical > 0 && (
            <span className="flex h-5 items-center rounded-full bg-red-600 px-2 text-[10px] font-bold text-white">
              {data.summary.critical} critical
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data.summary.totalAnomalies} anomalies · {data.summary.openCount} open
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {data.anomalies.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3">
            <span className={`mt-0.5 text-[8px] ${
              a.severity === "critical" ? "text-red-600" : a.severity === "warning" ? "text-amber-600" : "text-blue-600"
            }`}>●</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{a.agentName}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${SEVERITY_STYLES[a.severity] ?? ""}`}>
                  {a.severity}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.scope}</span>
              </div>
              <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.description}</div>
              <div className="mt-1.5 flex items-center gap-3">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.detectedAt).toLocaleDateString()} {new Date(a.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize ${STATUS_STYLES[a.status] ?? ""}`}>{a.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
