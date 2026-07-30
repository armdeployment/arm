"use client";

import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: "Platform",
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
      { label: "Identity", href: "/idp", icon: IdPIcon },
      { label: "Audit", href: "/audit", icon: AuditIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-sidebar)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex h-8 w-8 items-center justify-center text-[13px] font-bold"
          style={{ backgroundColor: "var(--navy)", color: "#fff", borderRadius: "var(--radius-sm)" }}
        >
          A
        </div>
        <div>
          <div className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            ARM
          </div>
          <div className="label-meta" style={{ fontSize: "9px" }}>
            Agent Resource Mgmt
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="label-meta px-5 py-1.5">{section.title}</div>
            {section.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-2.5 px-5 py-1.5 text-[13px] font-medium transition-colors duration-150"
                  style={{
                    backgroundColor: active ? "var(--navy-light)" : "transparent",
                    color: active ? "var(--navy)" : "var(--text-secondary)",
                    borderLeft: active ? "2px solid var(--navy)" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
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
                  <Icon active={active} />
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="status-dot live" />
          <span className="text-[11px] font-medium" style={{ color: "var(--text-label)" }}>
            Systems operational
          </span>
        </div>
      </div>

      {/* Tenant */}
      <div className="border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-6 w-6 items-center justify-center text-[9px] font-bold"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color: "var(--navy)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            AC
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
              Acme Manufacturing
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Enterprise
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Icons — 1.5px stroke, institutional precision ── */
type IconProps = { active?: boolean };

function DashboardIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
function AgentsIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
function SpendIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}
function AccessIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
function AuditIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}
function IdPIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12z" />
    </svg>
  );
}
function ResourcesIcon({ active }: IconProps) {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
