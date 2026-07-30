export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Audit</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Access audit events — every resource-access decision logged (spec §4.2, §6)
        </p>
      </div>

      <div
        className="rounded-2xl border p-12 text-center"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--accent-soft)" }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
        </div>
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Audit log viewer
        </div>
        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Connectors emit <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono">access_audit_event</code> records for every resource access decision. Dashboard lands in 1.1 —
          lands with 1.1 (LLM Metering &amp; Dashboards)
        </div>
        <div className="mt-5 flex justify-center gap-2">
          {["allow", "deny", "jit_grant"].map((t) => (
            <span key={t} className="rounded-lg px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              {t}
            </span>
          ))}
          <span className="rounded-lg px-2.5 py-1 text-[10px] font-mono" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" }}>
            PARTITION BY (tenant_id, toYYYYMM(ts))
          </span>
        </div>
      </div>
    </div>
  );
}
