/**
 * Package Governance (D9 — docs/solutions/2026-08-13-d9-work-packages.md §1.7).
 *
 * Per-package budgets, approvals inbox, and cost-per-work-product with the
 * rework-rate counterweight. Static fixture data from lib/catalog-mock
 * (mirrors packages/trpc catalogRouter fixtures).
 */

import { packageBudgets, approvalInbox, costPerWorkProduct } from "../../lib/catalog-mock";

export default function GovernancePage() {
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Cost per Work Product
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {costPerWorkProduct.map((c) => (
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
        {/* Per-package budget bars */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
          <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Package Budgets</h3>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>budget_template.monthly_usd_cap vs. metered usage</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            {packageBudgets.map((b) => {
              const pct = Math.min(Math.round((b.usedUsd / b.monthlyUsdCap) * 100), 100);
              const over = b.usedUsd > b.monthlyUsdCap;
              return (
                <div key={b.roleKey}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{b.name}</span>
                    <span className="tabular" style={{ color: over ? "var(--danger)" : "var(--text-secondary)" }}>
                      ${b.usedUsd.toLocaleString()} / ${b.monthlyUsdCap.toLocaleString()}/mo
                      {over && <span className="ml-1.5 font-semibold text-[10px] uppercase">over cap</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: over ? "var(--danger)" : "var(--navy)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approvals inbox */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Approvals Inbox</h3>
            <span className="flex h-6 items-center rounded-full px-2.5 text-xs font-bold text-white" style={{ backgroundColor: "var(--warning)" }}>
              {approvalInbox.length}
            </span>
          </div>
          {approvalInbox.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>No pending requests</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {approvalInbox.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {req.packageName}
                      <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--gold)" }}>{req.roleKey}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {req.requester} · {req.assigneeType.replace("_", " ")} · {req.requestedAt}
                    </div>
                  </div>
                  <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Approve</button>
                  <button className="rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:bg-red-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>Deny</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
