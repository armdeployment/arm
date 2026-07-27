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
      className="rounded-2xl border p-5 transition-shadow hover:shadow-md"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
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
      <div className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-xs font-medium" style={{ color: toneColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}
