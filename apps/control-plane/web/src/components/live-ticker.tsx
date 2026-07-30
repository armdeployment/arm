"use client";

import { trpc } from "../lib/trpc/client";

/**
 * Live ticker — polling-driven "realtime" snapshot of metering state.
 * Refetches every 10s (spec §5.3 realtime via tRPC, implemented as polling
 * until SSE adapter is wired in 1.2 when data plane exists).
 */
export function LiveTicker() {
  const { data, isLoading } = trpc.spend.liveSnapshot.useQuery(undefined, {
    refetchInterval: 10_000, // poll every 10s
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-[var(--bg-elevated)] px-4 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
        <span style={{backgroundColor:"var(--accent-soft)"}} className="h-1.5 w-1.5 animate-pulse rounded-full 0" />
        <span style={{ color: "var(--text-muted)" }}>Initializing live metering…</span>
      </div>
    );
  }

  const time = new Date(data.timestamp).toLocaleTimeString();
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border px-4 py-2"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--success)" }}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
        Live
      </span>
      <Metric label="Spend today" value={`$${data.spendTodayUsd.toLocaleString()}`} />
      <Metric label="Requests" value={data.requestsToday.toLocaleString()} />
      <Metric label="Active agents" value={String(data.activeAgents)} />
      <Metric label="Blocked by DLP" value={String(data.blockedByGate)} tone="warning" />
      <Metric label="Drift" value={`${data.driftPct}%`} tone={data.driftPct > 5 ? "danger" : "default"} />
      <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
        Updated {time} · polls every 10s
      </span>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "danger" }) {
  const color =
    tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--text-primary)";
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{value}</span>
    </span>
  );
}