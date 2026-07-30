"use client";

import { Suspense } from "react";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";
import { PolicySimulator } from "../../components/policy-simulator";

const STATUS_STYLES: Record<string, string> = {
  pending: "border border-[var(--border)] text-[var(--warning)] ring-1 ring-amber-200",
  approved: "bg-emerald-50 text-[var(--success)] ring-1 ring-emerald-200",
  denied: "border border-[var(--border)] text-[var(--danger)] ring-1 ring-red-200",
};

export default function AccessPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />}>
      <AccessPageContent />
    </Suspense>
  );
}

function AccessPageContent() {
  const scope = useScope();
  const { data, isLoading, refetch } = trpc.access.pendingApprovals.useQuery({ scope });
  const approveMutation = trpc.access.approve.useMutation({ onSuccess: () => refetch() });
  const denyMutation = trpc.access.deny.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-6">
      <div>
        <ScopeBreadcrumb scope={scope} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Access</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          JIT access requests — short-TTL elevation with stakeholder approval (spec §6.4)
        </p>
      </div>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]" style={{ borderColor: "var(--border)" }} />
      ) : (
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Pending Approvals</h3>
            {data.requests.length > 0 && (
              <span className="flex h-6 items-center rounded-full px-2.5 text-xs font-bold text-white" style={{ backgroundColor: "var(--warning)" }}>
                {data.requests.length}
              </span>
            )}
          </div>
          {data.requests.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>No pending requests</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Agent", "Resource", "Action", "Reason", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.requests.map((req) => (
                  <tr key={req.id} className="transition-colors hover:bg-slate-50" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-5 py-3.5 font-semibold" style={{ color: "var(--text-primary)" }}>{req.agentId}</td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{req.resourceId}</td>
                    <td className="px-5 py-3.5"><code className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{req.action}</code></td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-secondary)" }}>{req.reason}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status] ?? ""}`}>{req.status}</span></td>
                    <td className="px-3 py-3.5">
                      {req.status === "pending" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => approveMutation.mutate({ requestId: req.id })}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            disabled={approveMutation.isPending}
                          >Approve</button>
                          <button
                            onClick={() => denyMutation.mutate({ requestId: req.id, reason: "Denied by stakeholder" })}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            disabled={denyMutation.isPending}
                          >Deny</button>
                        </div>
                      )}
                      {req.status !== "pending" && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {new Date().toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
