"use client";

/**
 * Funnel panel — the hero panel of /adoption (guide 02 §2). Horizontal
 * stepped bar, absolute counts + conversion % between steps. Clicking a
 * step filters the table below (via onStepClick).
 */

import { DeferredShell, type PanelStatus } from "../deferred-shell";
import { trpc } from "../../lib/trpc/client";
import type { ScopeRef } from "../../lib/use-scope";

export interface FunnelStepRow {
  step: string;
  label: string;
  count: number;
  conversionFromPrev: number | null;
}

export interface FunnelPanelViewProps {
  status: PanelStatus;
  steps?: FunnelStepRow[];
  freshnessMs?: number;
  sampleData?: boolean;
  errorMessage?: string;
  selectedStep?: string | null;
  onStepClick?: (step: string) => void;
}

const STEP_COLOR = "var(--navy)";
const STEP_COLOR_SELECTED = "var(--gold)";

export function FunnelPanelView({ status, steps, freshnessMs, sampleData, errorMessage, selectedStep, onStepClick }: FunnelPanelViewProps) {
  const isEmpty = status === "ready" && (!steps || steps.length === 0 || steps.every((s) => s.count === 0));
  const effectiveStatus: PanelStatus = status === "ready" && isEmpty ? "empty" : status;
  const max = steps && steps.length > 0 ? steps[0]!.count : 1;

  return (
    <DeferredShell
      title="Activation Funnel"
      subtitle="eligible → invited → … → weekly active"
      status={effectiveStatus}
      minHeight={420}
      errorMessage={errorMessage}
      emptyMessage="No activation events in this window yet."
      freshnessMs={freshnessMs}
      sampleData={sampleData}
    >
      {steps && (
        <>
          <ul className="space-y-2" role="list" aria-label="Activation funnel steps">
            {steps.map((s) => {
              const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
              const selected = selectedStep === s.step;
              return (
                <li key={s.step}>
                  <button
                    type="button"
                    onClick={() => onStepClick?.(s.step)}
                    aria-pressed={selected}
                    className="group flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors"
                    style={{ backgroundColor: selected ? "var(--navy-light)" : "transparent" }}
                  >
                    <span className="w-[168px] shrink-0 truncate text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {s.label}
                    </span>
                    <span className="h-5 flex-1 overflow-hidden rounded" style={{ backgroundColor: "var(--bg-elevated)" }}>
                      <span
                        className="block h-full rounded"
                        style={{ width: `${pct}%`, backgroundColor: selected ? STEP_COLOR_SELECTED : STEP_COLOR }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-[12px] font-semibold tabular" style={{ color: "var(--text-primary)" }}>
                      {s.count}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[10px] tabular" style={{ color: "var(--text-muted)" }}>
                      {s.conversionFromPrev == null ? "—" : `${s.conversionFromPrev}%`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* WCAG 2.1 AA: accessible tabular fallback (guide 02 §2) */}
          <table className="sr-only">
            <caption>Activation funnel — step, count, conversion from previous step</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Count</th>
                <th scope="col">Conversion from previous</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.step}>
                  <td>{s.label}</td>
                  <td>{s.count}</td>
                  <td>{s.conversionFromPrev == null ? "n/a" : `${s.conversionFromPrev}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DeferredShell>
  );
}

/** Data-fetching container — wires the tRPC query into FunnelPanelView. */
export function FunnelPanel({
  scope,
  jobFunctionKey,
  selectedStep,
  onStepClick,
}: {
  scope: ScopeRef;
  jobFunctionKey?: string | null;
  selectedStep?: string | null;
  onStepClick?: (step: string) => void;
}) {
  const q = trpc.adoption.funnel.useQuery({ scope, jobFunctionKey: jobFunctionKey ?? null });

  if (q.isLoading) return <FunnelPanelView status="loading" />;
  if (q.isError) return <FunnelPanelView status="error" errorMessage={q.error?.message} />;

  return (
    <FunnelPanelView
      status="ready"
      steps={q.data!.steps}
      freshnessMs={q.data!.meta.ledgerFreshnessMs}
      sampleData={q.data!.meta.sampleData}
      selectedStep={selectedStep}
      onStepClick={onStepClick}
    />
  );
}
