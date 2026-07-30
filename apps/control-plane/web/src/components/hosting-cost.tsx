"use client";

import { trpc } from "../lib/trpc/client";

export function HostingCost() {
  const { data, isLoading } = trpc.spend.hostingCost.useQuery();

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-4 text-sm font-semibold">Hosting Cost Model</h3>
        <div className="h-20 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Self-Hosted Inference Cost</h3>
        <span style={{backgroundColor:"var(--accent-soft)"}} className="rounded-full  px-2.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
          GPU hours
        </span>
      </div>

      <div className="p-4">
        {data.models.map((m) => (
          <div key={m.model} className="mb-3 flex items-center gap-3 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              {m.instance.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.model}</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {m.instance} · {m.gpuHours}h @ ${m.costPerHour}/h
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                ${m.monthlyCost.toLocaleString()}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>/mo</div>
            </div>
          </div>
        ))}

        <div className="mt-2 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Total hosting
          </span>
          <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            ${data.totalHostingCost.toLocaleString()}/mo
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          <span className="text-xs font-medium text-emerald-700">
            If all traffic self-hosted: ${data.savingsVsApi.toLocaleString()}/mo saved vs API pricing
          </span>
        </div>
      </div>
    </div>
  );
}