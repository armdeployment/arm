"use client";

/**
 * Package Assignments (D9) — org tree × package matrix.
 *
 * Table of who has which work package in which status. Approve/deny/revoke
 * buttons are visual-only for now — TODO: wire to catalog.approveAssignment /
 * catalog.revokeAssignment. Static data from lib/catalog-mock.
 */

import { useState } from "react";
import { assignments as seedAssignments, type AssignmentRow } from "../../lib/catalog-mock";

const STATUS_STYLES: Record<string, string> = {
  requested: "border border-[var(--border)] text-[var(--warning)] ring-1 ring-amber-200",
  approved: "bg-blue-50 text-[var(--accent)] ring-1 ring-blue-200",
  active: "bg-emerald-50 text-[var(--success)] ring-1 ring-emerald-200",
  revoked: "border border-[var(--border)] text-[var(--danger)] ring-1 ring-red-200",
};

const TYPE_LABELS: Record<string, string> = { user: "User", agent: "Agent", org_node: "Org Node" };

export default function AssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>(seedAssignments);

  function transition(id: string, status: AssignmentRow["status"]) {
    // Visual-only for now — TODO: catalog.approveAssignment / catalog.revokeAssignment
    console.log(`[assignments] ${id} → ${status}`);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, approver: r.approver ?? "s.chan" } : r)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Package Assignments</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Who has which work package — requested → approved → active → revoked (D9 state machine)
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{rows.length} Assignments</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Assignee", "Type", "Package", "Mode", "Status", "Approver", "Requested", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b transition-colors hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3.5">
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{a.assignee}</div>
                </td>
                <td className="px-5 py-3.5"><span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{TYPE_LABELS[a.assigneeType] ?? a.assigneeType}</span></td>
                <td className="px-5 py-3.5">
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>{a.packageName}</div>
                  <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{a.roleKey}</div>
                </td>
                <td className="px-5 py-3.5"><span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase bg-[var(--bg-elevated)]" style={{ color: "var(--text-secondary)" }}>{a.mode}</span></td>
                <td className="px-5 py-3.5"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[a.status] ?? ""}`}>{a.status}</span></td>
                <td className="px-5 py-3.5 font-mono text-xs" style={{ color: a.approver ? "var(--text-secondary)" : "var(--text-muted)" }}>{a.approver ?? "—"}</td>
                <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-secondary)" }}>{a.requestedAt}</td>
                <td className="px-3 py-3.5">
                  <div className="flex gap-1">
                    {a.status === "requested" && (
                      <>
                        <button
                          onClick={() => transition(a.id, "approved")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                        >Approve</button>
                        <button
                          onClick={() => transition(a.id, "revoked")}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-700"
                        >Deny</button>
                      </>
                    )}
                    {(a.status === "approved" || a.status === "active") && (
                      <button
                        onClick={() => transition(a.id, "revoked")}
                        className="rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:bg-red-50"
                        style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                      >Revoke</button>
                    )}
                    {a.status === "revoked" && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
