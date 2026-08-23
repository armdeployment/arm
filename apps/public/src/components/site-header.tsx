import Link from "next/link";
import { primaryNav, siteName, siteTagline } from "@/content/nav";

export function SiteHeader() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6"
        style={{ maxWidth: "var(--content-max)" }}
      >
        <Link
          href="/"
          className="flex items-baseline gap-2 no-underline"
          aria-label={`${siteName} — home`}
        >
          <span className="text-lg font-semibold" style={{ color: "var(--navy)" }}>
            {siteName}
          </span>
          <span className="hidden text-sm sm:inline" style={{ color: "var(--text-muted)" }}>
            {siteTagline}
          </span>
        </Link>
        <nav aria-label="Primary">
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 sm:gap-x-6">
            {primaryNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium no-underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
