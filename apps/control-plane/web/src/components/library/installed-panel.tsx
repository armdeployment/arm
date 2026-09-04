"use client";

/**
 * /library → Installed — the fleet roll-up (the operator-facing other half of
 * the client's `arm update`).
 *
 * The Packages/Components tabs answer "what may people install"; this answers
 * "what did they install, and is it current". Reads `library.installSummary`,
 * which applies the same staleness rule the client's update path uses, so this
 * table and `arm update` can never disagree about what is behind.
 *
 * Scope note: these are components ARM installed from ARM's registry. Anything
 * a user installed themselves through another client is invisible here — see
 * docs/component-updates.md.
 */

import { StatCard } from "../stat-card";
import { trpc } from "../../lib/trpc/client";

export function InstalledPanel() {
  const summary = trpc.library.installSummary.useQuery();

  if (summary.isLoading) {
    return (
      <div
        className="h-64 animate-pulse rounded-lg border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
      />
    );
  }
  if (summary.isError) {
    return (
      <div role="alert" className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
        Couldn&apos;t load installed components.
      </div>
    );
  }

  const data = summary.data!;

  if (data.components.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border py-16 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          No agent has checked in yet
        </span>
        <span className="max-w-sm text-[12px]" style={{ color: "var(--text-muted)" }}>
          Agents report what they have installed when they run <code>arm setup</code>,{" "}
          <code>arm update</code>, or <code>arm doctor</code>. This table fills in from the first
          check-in.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Agents reporting"
          value={String(data.agents)}
          sub={`${data.installs} component install${data.installs === 1 ? "" : "s"}`}
        />
        <StatCard label="Components in use" value={String(data.components.length)} />
        <StatCard
          label="Machines behind"
          value={String(data.stale)}
          tone={data.stale > 0 ? "warning" : "success"}
          sub={data.stale > 0 ? "an update is available" : "everyone is current"}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {[
                "Component",
                "Latest",
                "Installed versions",
                "Agents",
                "Behind",
                "Last check-in",
              ].map((h) => (
                <th key={h} className="label-meta px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.components.map((c) => (
              <tr
                key={c.component_id}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.slug ?? c.component_id}
                  </div>
                  <div className="text-[11px] uppercase" style={{ color: "var(--text-muted)" }}>
                    {c.kind ?? "not in registry"}
                  </div>
                </td>
                <td className="tabular px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                  {c.latest_version ?? (
                    <span style={{ color: "var(--warning)" }}>
                      {c.in_registry ? "all versions yanked" : "unpublished"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.versions.map((v) => (
                      <span
                        key={v.version}
                        className="tabular rounded px-1.5 py-0.5 text-[11px]"
                        style={{
                          border: `1px solid ${v.stale ? "var(--warning)" : "var(--border)"}`,
                          color: v.stale ? "var(--warning)" : "var(--text-secondary)",
                        }}
                        title={v.stale ? "behind the registry" : "current"}
                      >
                        {v.version}
                        {v.count > 1 && ` ×${v.count}`}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="tabular px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                  {c.installs}
                </td>
                <td
                  className="tabular px-4 py-3 font-medium"
                  style={{ color: c.stale > 0 ? "var(--warning)" : "var(--text-muted)" }}
                >
                  {c.stale > 0 ? c.stale : "—"}
                </td>
                <td
                  className="tabular px-4 py-3 text-[12px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Components installed by ARM. Toolkits a user installed themselves through another client are
        not visible here.
      </p>
    </div>
  );
}
