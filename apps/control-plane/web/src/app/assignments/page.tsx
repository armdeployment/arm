"use client";

/**
 * Package Assignments (D9) — org tree × package matrix.
 *
 * Table of who has which work package in which status. Reads the real
 * `catalog.listAssignments` procedure; Approve/Deny/Revoke call
 * `catalog.approveAssignment` / `catalog.revokeAssignment` for real
 * (previously visual-only against lib/catalog-mock, now deleted per
 * docs/guides/02-server-panels.md §1).
 */

import { trpc } from "../../lib/trpc/client";

const STATUS_STYLES: Record<string, string> = {
  requested: "border border-[var(--border)] text-[var(--warning)] ring-1 ring-amber-200",
  approved: "bg-blue-50 text-[var(--accent)] ring-1 ring-blue-200",
  active: "bg-emerald-50 text-[var(--success)] ring-1 ring-emerald-200",
  revoked: "border border-[var(--border)] text-[var(--danger)] ring-1 ring-red-200",
};

const TYPE_LABELS: Record<string, string> = { user: "User", agent: "Agent", org_node: "Org Node" };

export default function AssignmentsPage() {
  const assignments = trpc.catalog.listAssignments.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => void utils.catalog.listAssignments.invalidate();
  const approve = trpc.catalog.approveAssignment.useMutation({ onSuccess: invalidate });
  const revoke = trpc.catalog.revokeAssignment.useMutation({ onSuccess: invalidate });

  const rows = assignments.data?.assignments ?? [];
  const pending = approve.isPending || revoke.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Package Assignments
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Who has which work package — requested → approved → active → revoked (D9 state machine)
        </p>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {rows.length} Assignments
          </h3>
        </div>
        {assignments.isLoading ? (
          <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No assignments yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Assignee",
                  "Type",
                  "Package",
                  "Mode",
                  "Status",
                  "Approver",
                  "Approved",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="border-b transition-colors hover:bg-slate-50"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-[11px]" style={{ color: "var(--text-primary)" }}>
                      {a.assigneeId.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {TYPE_LABELS[a.assigneeType] ?? a.assigneeType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {a.packageName ?? "—"}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {a.roleKey ?? "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase bg-[var(--bg-elevated)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.mode ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[a.status] ?? ""}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td
                    className="px-5 py-3.5 font-mono text-xs"
                    style={{
                      color: a.approverUserId ? "var(--text-secondary)" : "var(--text-muted)",
                    }}
                  >
                    {a.approverUserId ? `${a.approverUserId.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {a.approvedAt ?? "—"}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex gap-1">
                      {a.status === "requested" && (
                        <>
                          <button
                            onClick={() => approve.mutate({ assignmentId: a.id, approve: true })}
                            disabled={pending}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => approve.mutate({ assignmentId: a.id, approve: false })}
                            disabled={pending}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Deny
                          </button>
                        </>
                      )}
                      {a.status === "approved" && (
                        <button
                          onClick={() => approve.mutate({ assignmentId: a.id, approve: true })}
                          disabled={pending}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      )}
                      {(a.status === "approved" || a.status === "active") && (
                        <button
                          onClick={() => revoke.mutate({ assignmentId: a.id })}
                          disabled={pending}
                          className="rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:bg-red-50 disabled:opacity-60"
                          style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                        >
                          Revoke
                        </button>
                      )}
                      {a.status === "revoked" && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          —
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
