"use client";

import { trpc } from "../../lib/trpc/client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  denied: "bg-red-500/15 text-red-400",
};

export default function AccessPage() {
  const { data, isLoading } = trpc.access.pendingApprovals.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          JIT access requests — short-TTL elevation with stakeholder approval (spec §6.4)
        </p>
      </div>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }} />
      ) : (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold">Pending Approvals ({data.requests.length})</h3>
          </div>
          {data.requests.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No pending requests
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  {["Agent", "Resource", "Action", "Reason", "Status"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.requests.map((req) => (
                  <tr key={req.id} className="border-b transition-colors hover:bg-white/5" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-medium">{req.agentId}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{req.resourceId}</td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">{req.action}</code>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{req.reason}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? ""}`}>
                        {req.status}
                      </span>
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
