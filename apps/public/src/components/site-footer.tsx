import Link from "next/link";
import { footerNav, siteName } from "@/content/nav";

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div
        className="mx-auto flex flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        style={{ maxWidth: "var(--content-max)" }}
      >
        <p className="m-0 text-sm" style={{ color: "var(--text-muted)" }}>
          {siteName} — no invented customers, no fabricated metrics. Every number on this site
          traces to a source.
        </p>
        <nav aria-label="Footer">
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            {footerNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm no-underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
