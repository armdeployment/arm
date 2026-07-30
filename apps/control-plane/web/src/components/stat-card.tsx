interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, sub, tone = "default", icon }: StatCardProps) {
  const toneColor = {
    default: "var(--text-muted)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  }[tone];

  const toneBg = {
    default: "var(--bg-elevated)",
    success: "var(--success-soft)",
    warning: "var(--warning-soft)",
    danger: "var(--danger-soft)",
  }[tone];

  return (
    <div
      className="premium-card group p-5"
    >
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
        {icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: toneBg, color: toneColor }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        className="relative mt-3 text-[28px] font-bold tracking-tight tabular"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="relative mt-1.5 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: toneColor }}>
          {tone === "success" && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 18m0 0l7.5-7.5M12 18V4" />
            </svg>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}
