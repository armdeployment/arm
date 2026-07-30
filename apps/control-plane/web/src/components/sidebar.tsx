"use client";

import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: DashboardIcon },
      { label: "Agents", href: "/agents", icon: AgentsIcon },
      { label: "Spend", href: "/spend", icon: SpendIcon },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Access", href: "/access", icon: AccessIcon },
      { label: "Resources", href: "/resources", icon: ResourcesIcon },
      { label: "IdP", href: "/idp", icon: IdPIcon },
      { label: "Audit", href: "/audit", icon: AuditIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0, 102, 255, 0.2)",
          }}
        >
          A
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            ARM
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Agent Resource Mgmt
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-1">
            <div
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-dim)" }}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200"
                  style={{
                    backgroundColor: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                  )}
                  <Icon active={active} />
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Status indicator */}
      <div className="mx-3 mb-2 rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
        <div className="flex items-center gap-2">
          <span className="accent-dot animate-pulse-glow" />
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            All systems operational
          </span>
        </div>
        <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Proxy: online · 10 agents active
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent)", border: "1px solid var(--border-strong)" }}
          >
            AC
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Acme Manufacturing
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Enterprise · v2.0
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Icons ── */
type IconProps = { active?: boolean };

function DashboardIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
function AgentsIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
function SpendIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AccessIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
function AuditIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}
function IdPIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
function ResourcesIcon({ active }: IconProps) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  );
}
