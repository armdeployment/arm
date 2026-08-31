"use client";

/**
 * Deferred-Shell Panel (docs/CONCEPTS.md — "Deferred-Shell Panel"):
 * a footprint-matched skeleton occupies a panel's exact grid slot from the
 * first layout pass; arriving content replaces the shell in place. Grid
 * geometry never shifts when data lands. Every panel also carries explicit
 * loading/empty/error states and a stale-data badge when ledger freshness
 * exceeds a threshold (docs/guides/02-server-panels.md §2).
 */

import type { ReactNode } from "react";

export type PanelStatus = "loading" | "error" | "empty" | "ready";

/** Ledger freshness beyond this is considered stale (guide 02 §6.2). */
export const STALE_THRESHOLD_MS = 15 * 60_000; // 15 minutes

export interface DeferredShellProps {
  title: string;
  subtitle?: string;
  status: PanelStatus;
  /** Footprint-matched minimum height — keeps the grid slot stable across
   *  loading -> ready transitions. */
  minHeight: number;
  errorMessage?: string;
  emptyMessage?: string;
  /** Ledger freshness in ms — renders the stale badge when it exceeds
   *  STALE_THRESHOLD_MS. Omit when unknown (badge stays hidden). */
  freshnessMs?: number;
  sampleData?: boolean;
  headerExtra?: ReactNode;
  children?: ReactNode;
}

export function DeferredShell({
  title,
  subtitle,
  status,
  minHeight,
  errorMessage,
  emptyMessage,
  freshnessMs,
  sampleData,
  headerExtra,
  children,
}: DeferredShellProps) {
  const stale = typeof freshnessMs === "number" && freshnessMs > STALE_THRESHOLD_MS;

  return (
    <div
      className="inst-card p-5"
      style={{ minHeight }}
      data-panel-status={status}
      data-testid="deferred-shell"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="label-meta">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {sampleData && <SampleDataBadge />}
          {stale && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}
            >
              Stale data
            </span>
          )}
          {headerExtra}
        </div>
      </div>

      {status === "loading" && <SkeletonBody />}

      {status === "error" && (
        <div
          role="alert"
          className="flex min-h-[140px] flex-col items-center justify-center gap-1 text-center"
        >
          <span className="text-sm font-medium" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load this panel
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {errorMessage ?? "Try again shortly."}
          </span>
        </div>
      )}

      {status === "empty" && (
        <div className="flex min-h-[140px] flex-col items-center justify-center gap-1 text-center">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {emptyMessage ?? "No data yet."}
          </span>
        </div>
      )}

      {status === "ready" && children}
    </div>
  );
}

function SkeletonBody() {
  return (
    <div className="space-y-2.5" aria-hidden="true" data-testid="panel-skeleton">
      <div
        className="h-4 w-3/4 animate-pulse rounded"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
      <div
        className="h-4 w-1/2 animate-pulse rounded"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
      <div
        className="h-24 w-full animate-pulse rounded"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
    </div>
  );
}

/** guide 02 §5.1: "label them as fixtures in the UI when ARM_FIXTURE_MODE=1
 *  (a small 'sample data' badge in the header — the `site` agent depends on
 *  this badge existing for /demo)." Exported standalone too, for placement
 *  outside a DeferredShell (e.g. the global layout header). */
export function SampleDataBadge() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: "var(--navy-light)", color: "var(--navy)" }}
      data-testid="sample-data-badge"
    >
      Sample data
    </span>
  );
}
