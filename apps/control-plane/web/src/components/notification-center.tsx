"use client";

const ALERTS = [
  { id: "a1", type: "budget_warning", severity: "warning", scope: "Manufacturing", message: "Budget at 76% — Assembly Line A close to monthly cap", time: "2 hours ago" },
  { id: "a2", type: "tier_action", severity: "info", scope: "Engineering", message: "ux-optimizer auto-downgraded to GLM-5.2 (background tier)", time: "5 hours ago" },
  { id: "a3", type: "budget_critical", severity: "critical", scope: "Operations", message: "Incident Response team exceeded 90% budget — drawing from reserve", time: "1 day ago" },
  { id: "a4", type: "drift", severity: "warning", scope: "All", message: "Reconciliation drift 2.0% — provider bill vs proxy metering within tolerance", time: "2 days ago" },
];

const SEVERITY_ICONS: Record<string, { icon: string; bg: string; text: string }> = {
  critical: { icon: "●", bg: "bg-red-50", text: "text-red-600" },
  warning: { icon: "●", bg: "bg-amber-50", text: "text-amber-600" },
  info: { icon: "●", bg: "bg-blue-50", text: "text-blue-600" },
};

export function NotificationCenter() {
  return (
    <div
      className="rounded-2xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Notifications
        </h3>
        <span className="flex h-5 items-center rounded-full bg-blue-600 px-2 text-[10px] font-bold text-white">
          {ALERTS.length}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {ALERTS.map((a) => {
          const sev = (SEVERITY_ICONS[a.severity] ?? SEVERITY_ICONS.info)!;
          return (
            <div key={a.id} className="flex items-start gap-3 px-5 py-3">
              <span className={`mt-0.5 text-[8px] ${sev.text}`}>{sev.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {a.scope}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {a.message}
                </div>
                <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {a.time}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${sev.bg} ${sev.text}`}
              >
                {a.severity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
