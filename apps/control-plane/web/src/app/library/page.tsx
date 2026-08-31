"use client";

/**
 * /library — the browse surface (docs/guides/02-server-panels.md §4).
 *
 * Search box + facet rail (kind, job function, data classification, mode,
 * source) + result grid. Two tabs: Packages (the app-store view that
 * /catalog prototyped — now real, reading `catalog.listPackages`) and
 * Components (MCPs, skills, plugins, templates — reads `library.search`
 * /`library.facets`, which are Wave-0 placeholders returning typed empty
 * fixtures until the `library` Wave-1 agent lands
 * docs/guides/01-library-artifactory.md). Third tab Discovery: candidate
 * queue with promote/reject, also placeholder-backed for now.
 *
 * `/catalog` now redirects here (see app/catalog/page.tsx) — this page
 * reuses that page's card layout (guide 02 §4).
 */

import { Suspense, useMemo, useState } from "react";
import { PackageCard } from "../../components/library/package-card";
import { trpc } from "../../lib/trpc/client";

type Tab = "packages" | "components" | "discovery";

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]"
          style={{ borderColor: "var(--border)" }}
        />
      }
    >
      <LibraryPageContent />
    </Suspense>
  );
}

function LibraryPageContent() {
  const [tab, setTab] = useState<Tab>("packages");
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Library
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Search packages and components — the real artifactory (A2): immutable, versioned, signed
          manifests
        </p>
      </div>

      {/* Search box */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search packages and components…"
          aria-label="Search library"
          className="w-full max-w-md rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }} role="tablist">
        {(
          [
            ["packages", "Packages"],
            ["components", "Components"],
            ["discovery", "Discovery"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="px-4 py-2 text-[13px] font-medium"
            style={{
              color: tab === key ? "var(--navy)" : "var(--text-secondary)",
              borderBottom: tab === key ? "2px solid var(--navy)" : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <FacetRail tab={tab} />
        <div>
          {tab === "packages" && <PackagesTab query={query} />}
          {tab === "components" && <ComponentsTab query={query} />}
          {tab === "discovery" && <DiscoveryTab />}
        </div>
      </div>
    </div>
  );
}

// ── Facet rail (guide 02 §4: kind, job function, data classification, mode, source) ──

function FacetRail({ tab }: { tab: Tab }) {
  const facets = trpc.library.facets.useQuery();
  const packages = trpc.catalog.listPackages.useQuery(undefined, { enabled: tab === "packages" });

  // Components/Discovery facets come from library.facets — empty until the
  // `library` Wave-1 agent lands real data (Wave-0 placeholder contract).
  const facetGroups: { title: string; entries: [string, number][] }[] =
    tab === "packages" && packages.data
      ? [
          {
            title: "Family",
            entries: Object.entries(
              packages.data.packages.reduce<Record<string, number>>((acc, p) => {
                acc[p.family] = (acc[p.family] ?? 0) + 1;
                return acc;
              }, {}),
            ),
          },
          {
            title: "Mode",
            entries: Object.entries(
              packages.data.packages.reduce<Record<string, number>>((acc, p) => {
                acc[p.mode] = (acc[p.mode] ?? 0) + 1;
                return acc;
              }, {}),
            ),
          },
        ]
      : Object.entries(facets.data?.facets ?? {}).map(([title, counts]) => ({
          title,
          entries: Object.entries(counts),
        }));

  return (
    <aside className="space-y-5" aria-label="Filter by facet">
      {["Kind", "Job function", "Data classification", "Mode", "Source"].map((label) => {
        const group = facetGroups.find((g) => g.title.toLowerCase() === label.toLowerCase());
        return (
          <div key={label}>
            <div className="label-meta mb-1.5">{label}</div>
            {group && group.entries.length > 0 ? (
              <ul className="space-y-1">
                {group.entries.map(([value, count]) => (
                  <li
                    key={value}
                    className="flex items-center justify-between text-[12px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="capitalize">{value}</span>
                    <span className="tabular" style={{ color: "var(--text-muted)" }}>
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                No facets yet
              </p>
            )}
          </div>
        );
      })}
    </aside>
  );
}

// ── Packages tab (real data — catalog.listPackages) ─────────────────────────

function PackagesTab({ query }: { query: string }) {
  const packages = trpc.catalog.listPackages.useQuery();

  if (packages.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          />
        ))}
      </div>
    );
  }
  if (packages.isError) {
    return (
      <div role="alert" className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
        Couldn&apos;t load packages.
      </div>
    );
  }

  const filtered = packages.data!.packages.filter(
    (p) =>
      query.trim() === "" ||
      `${p.name} ${p.roleKey} ${p.family} ${p.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No packages match &ldquo;{query}&rdquo;.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={{
            id: pkg.id,
            roleKey: pkg.roleKey,
            name: pkg.name,
            family: pkg.family,
            mode: pkg.mode,
            description: pkg.description,
            componentCount: pkg.componentCount,
            monthlyUsdCap: pkg.monthlyUsdCap,
          }}
        />
      ))}
    </div>
  );
}

// ── Components tab (Wave-0 placeholder — library.search/facets) ────────────

function ComponentsTab({ query }: { query: string }) {
  const search = trpc.library.search.useQuery({ q: query || undefined });

  if (search.isLoading) {
    return (
      <div
        className="h-48 animate-pulse rounded-lg border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
      />
    );
  }
  if (search.isError) {
    return (
      <div role="alert" className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
        Couldn&apos;t load components.
      </div>
    );
  }

  const results = search.data!.items;

  if (results.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border py-16 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          No components published yet
        </span>
        <span className="max-w-sm text-[12px]" style={{ color: "var(--text-muted)" }}>
          The Component Registry (MCPs, skills, plugins, templates) lands with
          docs/guides/01-library-artifactory.md. This tab is wired to <code>library.search</code>{" "}
          and will populate automatically once that ships.
        </span>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((c) => (
        <li key={c.id} className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          {c.name}{" "}
          <span className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
            {c.type}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Discovery tab (admins) — candidate queue with promote/reject ───────────

function DiscoveryTab() {
  const candidates = trpc.library.listCandidates.useQuery();
  const sources = trpc.library.listSources.useQuery();
  const utils = trpc.useUtils();
  const promote = trpc.library.promoteCandidate.useMutation({
    onSuccess: () => void utils.library.listCandidates.invalidate(),
  });
  const reject = trpc.library.rejectCandidate.useMutation({
    onSuccess: () => void utils.library.listCandidates.invalidate(),
  });

  const rows = candidates.data?.candidates ?? [];
  const srcCount = sources.data?.sources.length ?? 0;

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  return (
    <div className="space-y-4">
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        {srcCount} discovery source{srcCount === 1 ? "" : "s"} configured · candidates awaiting
        triage
      </p>

      {candidates.isLoading ? (
        <div
          className="h-32 animate-pulse rounded-lg border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        />
      ) : rows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border py-16 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            No discovery candidates pending triage
          </span>
          <span className="max-w-sm text-[12px]" style={{ color: "var(--text-muted)" }}>
            Wired to <code>library.listCandidates</code> / <code>promoteCandidate</code> /{" "}
            <code>rejectCandidate</code> — populates once docs/guides/01-library-artifactory.md
            lands discovery sources.
          </span>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border" style={{ borderColor: "var(--border)" }}>
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.name}
                </div>
                <div className="text-[11px] uppercase" style={{ color: "var(--text-muted)" }}>
                  {c.proposed_kind}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => promote.mutate({ candidateId: c.id, slug: slugify(c.name) })}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                >
                  Promote
                </button>
                <button
                  onClick={() => reject.mutate({ candidateId: c.id })}
                  className="rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:bg-red-50"
                  style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
