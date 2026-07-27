interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

export function StatCard({ label, value, sub, tone = "default" }: StatCardProps) {
  const toneColor = {
    default: "var(--text-secondary)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  }[tone];

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: toneColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}
