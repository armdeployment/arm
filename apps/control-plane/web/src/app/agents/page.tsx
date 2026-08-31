"use client";

import { Suspense, useState } from "react";
import { AgentsTable } from "../../components/agents-table";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";
import type { AgentRow } from "../../lib/mock-data";

const STATUS_FILTERS = ["all", "active", "disabled"] as const;

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]"
          style={{ borderColor: "var(--border)" }}
        />
      }
    >
      <AgentsPageContent />
    </Suspense>
  );
}

function AgentsPageContent() {
  const scope = useScope();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const { data, isLoading } = trpc.agents.list.useQuery({ scope, status: statusFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <ScopeBreadcrumb scope={scope} />
          <h1
            className="mt-2 text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Agents
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Governed identities — every agent has an accountable stakeholder (Invariant §11.7)
          </p>
        </div>
        <div
          className="flex gap-1 rounded-md border p-1"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
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
        <div
          className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]"
          style={{ borderColor: "var(--border)" }}
        />
      ) : data.agents.length === 0 ? (
        <div
          className="rounded-lg border px-5 py-16 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          No agents in this scope
        </div>
      ) : (
        <AgentsTable data={data.agents as AgentRow[]} />
      )}
    </div>
  );
}
