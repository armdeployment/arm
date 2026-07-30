interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, sub, tone = "default", icon }: StatCardProps) {
  const subColor = {
    default: "var(--text-muted)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  }[tone];

  return (
    <div className="inst-card inst-card-hover p-5">
      <div className="flex items-start justify-between">
        <span className="label-meta">{label}</span>
        {icon && <span style={{ color: "var(--text-muted)" }}>{icon}</span>}
      </div>
      <div
        className="mt-2.5 text-[26px] font-semibold tracking-tight tabular"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[12px] font-medium tabular" style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}
