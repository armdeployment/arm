"use client";

/**
 * Work Package Catalog (D9 — docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Role-scoped agent tool bundles, app-store style. Data is static fixture via
 * lib/catalog-mock (mirrors packages/trpc catalogRouter); the Request button
 * is visual-only until the assignment flow wires to catalog.requestAssignment.
 */

import { useState } from "react";
import { catalogPackages, type CatalogPackageRow } from "../../lib/catalog-mock";

const MODE_STYLES: Record<string, string> = {
  copilot: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  automated: "bg-amber-50 text-[var(--warning)] ring-1 ring-amber-200",
};

export default function CatalogPage() {
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  function requestPackage(id: string) {
    // Visual-only for now — TODO: catalog.requestAssignment({ packageVersionId, ... })
    console.log(`[catalog] request assignment for package ${id}`);
    setRequestedIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Work Package Catalog</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Role-scoped agent tool bundles — request a package and your agent arrives configured (D9)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalogPackages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            requested={requestedIds.has(pkg.id)}
            onRequest={() => requestPackage(pkg.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PackageCard({ pkg, requested, onRequest }: { pkg: CatalogPackageRow; requested: boolean; onRequest: () => void }) {
  return (
    <div
      className="flex flex-col rounded-lg border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pkg.name}</div>
          <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--gold)" }}>{pkg.roleKey}</div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${MODE_STYLES[pkg.mode] ?? ""}`}>
          {pkg.mode}
        </span>
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{pkg.family}</div>

      <p className="mt-3 flex-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{pkg.description}</p>

      <div className="mt-4 flex flex-wrap gap-1">
        {pkg.tools.map((t) => (
          <span key={t} className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t}
          </span>
        ))}
        <span className="rounded bg-[var(--navy-light)] px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: "var(--navy)" }}>
          {pkg.toolCount} tools
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {pkg.toolCount} tool{pkg.toolCount === 1 ? "" : "s"} · {pkg.mode === "copilot" ? "human-in-the-loop" : "runs unattended"}
        </div>
        <button
          onClick={onRequest}
          disabled={requested}
          className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: requested ? "var(--success)" : "var(--navy)" }}
        >
          {requested ? "Requested ✓" : "Request"}
        </button>
      </div>
    </div>
  );
}
