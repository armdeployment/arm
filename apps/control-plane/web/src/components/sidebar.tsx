"use client";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "▣" },
  { label: "Agents", href: "/agents", icon: "◇" },
  { label: "Spend", href: "/spend", icon: "$" },
  { label: "Access", href: "/access", icon: "🔓" },
  { label: "Audit", href: "/audit", icon: "📋" },
];

export function Sidebar() {
  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          A
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide">ARM</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Agent Resource Mgmt
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="w-4 text-center text-xs opacity-60">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="border-t px-5 py-4 text-[10px]" style={{ borderColor: "var(--border)" }}>
        <div style={{ color: "var(--text-muted)" }}>Tenant: Acme Corp</div>
        <div className="mt-1" style={{ color: "var(--text-muted)" }}>
          v0.5 · spec §5.3
        </div>
      </div>
    </aside>
  );
}
