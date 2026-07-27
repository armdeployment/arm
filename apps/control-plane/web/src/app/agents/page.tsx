"use client";

import { useState } from "react";
import { AgentsTable } from "../../components/agents-table";
import { trpc } from "../../lib/trpc/client";
import type { AgentRow } from "../../lib/mock-data";

const STATUS_FILTERS = ["all", "active", "disabled"] as const;

export default function AgentsPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const { data, isLoading } = trpc.agents.list.useQuery({ status: statusFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Agents</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Governed identities — every agent has an accountable stakeholder (Invariant §11.7)
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all"
              style={{
                backgroundColor: statusFilter === f ? "var(--accent)" : "transparent",
                color: statusFilter === f ? "white" : "var(--text-secondary)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-2xl border bg-slate-100" style={{ borderColor: "var(--border)" }} />
      ) : (
        <AgentsTable data={data.agents as AgentRow[]} />
      )}
    </div>
  );
}
