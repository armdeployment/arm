"use client";

/**
 * Coverage panel (guide 02 §2): job function (rows) × published-package /
 * activated-seats (cols), headcount-weighted, sorted by uncovered weight.
 */

import { DeferredShell, type PanelStatus } from "../deferred-shell";
import { trpc } from "../../lib/trpc/client";
import type { ScopeRef } from "../../lib/use-scope";

export interface CoverageRow {
  jobFunctionKey: string;
  name: string;
  departmentName: string;
  headcountWeight: number;
  packages: string[];
  activatedSeats: number;
  eligibleSeats: number;
  uncoveredWeight: number;
}

export interface CoveragePanelViewProps {
  status: PanelStatus;
  rows?: CoverageRow[];
  freshnessMs?: number;
  sampleData?: boolean;
  errorMessage?: string;
}

export function CoveragePanelView({ status, rows, freshnessMs, sampleData, errorMessage }: CoveragePanelViewProps) {
  const isEmpty = status === "ready" && (!rows || rows.length === 0);
  const effectiveStatus: PanelStatus = status === "ready" && isEmpty ? "empty" : status;

  return (
    <DeferredShell
      title="Coverage"
      subtitle="job function × package / activated seats"
      status={effectiveStatus}
      minHeight={340}
      errorMessage={errorMessage}
      emptyMessage="No job functions in scope."
      freshnessMs={freshnessMs}
      sampleData={sampleData}
    >
      {rows && (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Coverage table, scrollable">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="label-meta py-1.5 pr-3 font-semibold">Job function</th>
                <th className="label-meta py-1.5 pr-3 font-semibold">Package</th>
                <th className="label-meta py-1.5 pr-3 text-right font-semibold">Activated</th>
                <th className="label-meta py-1.5 pr-3 text-right font-semibold">Eligible</th>
                <th className="label-meta py-1.5 text-right font-semibold">Uncovered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const covered = r.packages.length > 0;
                const pct = r.eligibleSeats > 0 ? Math.round((r.activatedSeats / r.eligibleSeats) * 100) : 0;
                return (
                  <tr key={r.jobFunctionKey} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{r.name}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.departmentName}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {covered ? (
                        <span className="rounded bg-[var(--navy-light)] px-1.5 py-0.5 text-[10px] font-medium" style={{ color: "var(--navy)" }}>
                          {r.packages.join(", ")}
                        </span>
                      ) : (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
                        >
                          No package — gap
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">{r.activatedSeats} <span style={{ color: "var(--text-muted)" }}>({pct}%)</span></td>
                    <td className="py-2 pr-3 text-right tabular" style={{ color: "var(--text-secondary)" }}>{r.eligibleSeats}</td>
                    <td className="py-2 text-right font-semibold tabular" style={{ color: r.uncoveredWeight > 0 ? "var(--warning)" : "var(--success)" }}>
                      {r.uncoveredWeight}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DeferredShell>
  );
}

export function CoveragePanel({ scope, jobFunctionKey }: { scope: ScopeRef; jobFunctionKey?: string | null }) {
  const q = trpc.adoption.coverage.useQuery({ scope, jobFunctionKey: jobFunctionKey ?? null });

  if (q.isLoading) return <CoveragePanelView status="loading" />;
  if (q.isError) return <CoveragePanelView status="error" errorMessage={q.error?.message} />;

  return (
    <CoveragePanelView
      status="ready"
      rows={q.data!.rows}
      freshnessMs={q.data!.meta.ledgerFreshnessMs}
      sampleData={q.data!.meta.sampleData}
    />
  );
}
