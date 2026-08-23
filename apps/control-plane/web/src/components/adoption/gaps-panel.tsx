"use client";

/**
 * Gaps panel (guide 02 §2): ranked list from `library.gaps`, each row links
 * to `/library` prefiltered. `library.gaps` is a Wave-0 placeholder
 * (packages/trpc/src/library-router.ts, owned by the `library` Wave-1
 * agent) — it returns a typed empty fixture until that module lands, so
 * this panel's populated state is exercised by its own view-level tests
 * (below) rather than by the live app today. That's the intended shape:
 * guide 02 §3 — "Until the `client`/`library` agents land, those return
 * empty fixtures — build the empty states properly, they are half the
 * work anyway."
 */

import { DeferredShell, type PanelStatus } from "../deferred-shell";
import { trpc } from "../../lib/trpc/client";

export interface GapRow {
  jobFunctionKey: string;
  name: string;
  uncoveredWeight: number;
}

export interface GapsPanelViewProps {
  status: PanelStatus;
  rows?: GapRow[];
  errorMessage?: string;
}

export function GapsPanelView({ status, rows, errorMessage }: GapsPanelViewProps) {
  const isEmpty = status === "ready" && (!rows || rows.length === 0);
  const effectiveStatus: PanelStatus = status === "ready" && isEmpty ? "empty" : status;

  return (
    <DeferredShell
      title="Coverage Gaps"
      subtitle="job functions with no published package"
      status={effectiveStatus}
      minHeight={220}
      errorMessage={errorMessage}
      emptyMessage="No gaps reported by the library yet."
    >
      {rows && rows.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }} role="list">
          {rows.map((g) => (
            <li key={g.jobFunctionKey} className="flex items-center justify-between py-2">
              <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{g.name}</span>
              <a
                href={`/library?gap=${encodeURIComponent(g.jobFunctionKey)}`}
                className="rounded px-2 py-1 text-[11px] font-semibold"
                style={{ color: "var(--navy)", backgroundColor: "var(--navy-light)" }}
              >
                {g.uncoveredWeight} uncovered → Library
              </a>
            </li>
          ))}
        </ul>
      )}
    </DeferredShell>
  );
}

export function GapsPanel() {
  const q = trpc.library.gaps.useQuery();

  if (q.isLoading) return <GapsPanelView status="loading" />;
  if (q.isError) return <GapsPanelView status="error" errorMessage={q.error?.message} />;

  return <GapsPanelView status="ready" rows={q.data!.gaps as GapRow[]} />;
}
