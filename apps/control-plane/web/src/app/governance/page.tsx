"use client";

/**
 * Package Governance (D9 — docs/solutions/2026-08-13-d9-work-packages.md
 * §1.7, updated docs/guides/02-server-panels.md §1: "$/work-product
 * dashboards move from /spend to /governance" — already true here; kept).
 *
 * Budgets and approvals now read the REAL `catalog.listPackages` /
 * `catalog.listAssignments` procedures (Approve/Deny call
 * `catalog.approveAssignment` for real). `catalog-mock.ts` is deleted per
 * guide 02 §1 acceptance criteria; the one still-synthetic figure
 * (per-package metered spend) lives in lib/governance-fixtures.ts,
 * explicitly labeled — see that file's header for why.
 */

import { SampleDataBadge } from "../../components/deferred-shell";
import { SAMPLE_USED_USD_BY_ROLE_KEY, SAMPLE_COST_PER_WORK_PRODUCT } from "../../lib/governance-fixtures";
import { trpc } from "../../lib/trpc/client";

export default function GovernancePage() {
  const packages = trpc.catalog.listPackages.useQuery();
  const assignments = trpc.catalog.listAssignments.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.catalog.approveAssignment.useMutation({
    onSuccess: () => void utils.catalog.listAssignments.invalidate(),
  });

  const pendingApprovals = (assignments.data?.assignments ?? []).filter((a) => a.status === "requested");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Package Governance</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Budgets, approvals, and cost-per-work-product — the package is the unit of governance (D9)
        </p>
      </div>

      {/* Cost-per-work-product */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Cost per Work Product
          </h2>
          <SampleDataBadge />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SAMPLE_COST_PER_WORK_PRODUCT.map((c) => (
            <div key={c.id} className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.workProduct}</div>
                <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{c.unit}</div>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular" style={{ color: "var(--navy)" }}>
                ${c.effectiveUsd.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                raw ${c.rawUsd} · rework-rate counterweight {c.reworkRatePct}%
              </div>
              <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Re-opened work products re-burn tokens — effective cost = raw × (1 + {c.reworkRatePct}%).
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Per-package budget bars — caps are real (catalog.listPackages); usage is labeled sample data */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Package Budgets</h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>budget_template.monthly_usd_cap vs. metered usage</p>
            </div>
            <SampleDataBadge />
          </div>
          <div className="space-y-4 px-5 py-4">
            {packages.isLoading && (
              <div className="h-32 animate-pulse rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
            )}
            {packages.data?.packages.map((pkg) => {
              const cap = pkg.monthlyUsdCap ?? 0;
              const used = SAMPLE_USED_USD_BY_ROLE_KEY[pkg.roleKey] ?? 0;
              const pct = cap > 0 ? Math.min(Math.round((used / cap) * 100), 100) : 0;
              const over = cap > 0 && used > cap;
              return (
                <div key={pkg.id}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{pkg.name}</span>
                    <span className="tabular" style={{ color: over ? "var(--danger)" : "var(--text-secondary)" }}>
                      ${used.toLocaleString()} / ${cap.toLocaleString()}/mo
                      {over && <span className="ml-1.5 font-semibold text-[10px] uppercase">over cap</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? "var(--danger)" : "var(--navy)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approvals inbox — real catalog.listAssignments, Approve/Deny call catalog.approveAssignment */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Approvals Inbox</h3>
            <span className="flex h-6 items-center rounded-full px-2.5 text-xs font-bold text-white" style={{ backgroundColor: "var(--warning)" }}>
              {pendingApprovals.length}
            </span>
          </div>
          {assignments.isLoading ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>No pending requests</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {pendingApprovals.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {req.packageName}
                      <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--gold)" }}>{req.roleKey}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {req.assigneeId} · {req.assigneeType.replace("_", " ")}
                    </div>
                  </div>
                  <button
                    onClick={() => decide.mutate({ assignmentId: req.id, approve: true })}
                    disabled={decide.isPending}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide.mutate({ assignmentId: req.id, approve: false })}
                    disabled={decide.isPending}
                    className="rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:bg-red-50 disabled:opacity-60"
                    style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                  >
                    Deny
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
