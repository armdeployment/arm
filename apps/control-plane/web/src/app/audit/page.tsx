export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Access audit events — every resource-access decision logged (spec §4.2, §6)
        </p>
      </div>

      <div
        className="rounded-xl border p-12 text-center"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Audit log viewer
        </div>
        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Reads from ClickHouse <code className="rounded bg-white/5 px-1.5 py-0.5">access_audit_event</code> —
          lands with 1.1 (LLM Metering &amp; Dashboards)
        </div>
        <div className="mt-4 flex justify-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="rounded px-2 py-1" style={{ backgroundColor: "var(--bg-elevated)" }}>
            allow · deny · jit_grant
          </span>
          <span className="rounded px-2 py-1" style={{ backgroundColor: "var(--bg-elevated)" }}>
            PARTITION BY (tenant_id, toYYYYMM(ts))
          </span>
        </div>
      </div>
    </div>
  );
}
