import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto px-4 sm:px-6 ${className}`} style={{ maxWidth: "var(--content-max)" }}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className = "",
  id,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "default" | "surface" | "dark";
}) {
  const bg =
    tone === "surface" ? "var(--bg-surface)" : tone === "dark" ? "var(--bg-dark)" : "transparent";
  const color = tone === "dark" ? "var(--text-on-dark)" : "var(--text-primary)";
  return (
    <section
      id={id}
      className={`py-12 sm:py-16 ${className}`}
      style={{ background: bg, color }}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Kicker({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "dark" }) {
  // On a dark section background (var(--bg-dark)), var(--gold) measures
  // 3.55:1 — below WCAG AA's 4.5:1 for normal text (axe caught this on
  // /product's "category" section). --gold-on-dark is a lighter amber tuned
  // for that background; use it whenever Kicker sits inside a tone="dark" Section.
  const color = tone === "dark" ? "var(--gold-on-dark)" : "var(--gold)";
  return (
    <p className="label-meta m-0 mb-3" style={{ color }}>
      {children}
    </p>
  );
}

export function ProseP({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`m-0 ${className}`}
      style={{ color: "var(--text-secondary)", maxWidth: "var(--prose-max)", lineHeight: 1.7 }}
    >
      {children}
    </p>
  );
}

export function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-x inst-card">
      <table className="w-full border-collapse text-sm" style={{ minWidth: "36rem" }}>
        {children}
      </table>
    </div>
  );
}

export function StatCard({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="inst-card p-5">
      <p className="label-meta m-0 mb-2">{label}</p>
      <p className="tabular m-0 mb-2 text-3xl font-semibold" style={{ color: "var(--navy)" }}>
        {value}
      </p>
      <p className="m-0 text-xs" style={{ color: "var(--text-muted)" }}>
        {source}
      </p>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "info" }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--bg-elevated)", fg: "var(--text-secondary)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
    info: { bg: "var(--navy-light)", fg: "var(--navy)" },
  };
  const c = colors[tone] ?? colors.neutral!;
  return (
    <span
      className="label-meta inline-block rounded-full px-3 py-1"
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}
