"use client";

import { trpc } from "../lib/trpc/client";

/**
 * GPU Capacity Brokering Panel (spec §9 Phase 3).
 * Shows self-hosted GPU allocation across the org — who's using what,
 * how many GPUs are available, and the monthly hosting cost.
 */
export function GPUBrokeringPanel() {
  const { data, isLoading } = trpc.gpu.capacity.useQuery();

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-4 text-sm font-semibold">GPU Capacity</h3>
        <div className="h-28 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>GPU Capacity (Self-Hosted)</h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>${data.monthlyCost}/mo hosting</span>
      </div>
      <div className="p-4 space-y-3">
        {data.pools.map((pool) => (
          <div key={pool.id} className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pool.name}</span>
                <span className="ml-2 text-[10px]" style={{ color: "var(--text-muted)" }}>{pool.department} · {pool.model}</span>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {pool.availableGpus}/{pool.gpus} free
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.round((pool.allocatedGpus / pool.gpus) * 100)}%`,
                backgroundColor: pool.availableGpus === 0 ? "var(--danger)" : "var(--accent)"
              }} />
            </div>
            <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {pool.allocatedGpus} allocated · ${pool.hourlyRate}/GPU-h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
