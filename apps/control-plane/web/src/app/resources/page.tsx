/**
 * Resource Catalog (spec §9 1.3, §4.1 Resource).
 *
 * Shows governed data sources across the org: S3 buckets, GCS, DBs, SharePoint sites.
 * Each resource has a connector, classification level, and grants.
 */

const RESOURCES = [
  { id: "r1", name: "CAD Files", type: "s3", connector: "s3-mint", externalRef: "s3://engineering/cad-files", classification: "confidential", tags: ["engineering", "cad"], grants: 4 },
  { id: "r2", name: "Production Logs", type: "s3", connector: "s3-mint", externalRef: "s3://prod-logs", classification: "internal", tags: ["manufacturing", "logs"], grants: 3 },
  { id: "r3", name: "ERP Database", type: "db", connector: "db-proxy", externalRef: "postgres://erp.internal:5432/acme", classification: "confidential", tags: ["finance", "hr"], grants: 6 },
  { id: "r4", name: "Engineering SharePoint", type: "sharepoint", connector: "sp-mint", externalRef: "https://acme.sharepoint.com/sites/eng", classification: "internal", tags: ["engineering", "docs"], grants: 5 },
  { id: "r5", name: "Analytics DB", type: "db", connector: "db-proxy", externalRef: "snowflake://acme.analytics", classification: "internal", tags: ["data", "analytics"], grants: 2 },
  { id: "r6", name: "R&D Research Data", type: "gcs", connector: "gcs-mint", externalRef: "gs://rnd-research/", classification: "restricted", tags: ["r&d", "research"], grants: 3 },
];

const TYPE_STYLES: Record<string, string> = { s3: "border border-[var(--border)] text-[var(--warning)]", gcs: "bg-blue-50 text-[var(--accent)]", db: "bg-purple-50 text-purple-600", sharepoint: "bg-cyan-50 text-cyan-600" };
const CLASS_STYLES: Record<string, string> = { public: "border border-[var(--border)] text-[var(--success)]", internal: "bg-blue-50 text-[var(--accent)]", confidential: "border border-[var(--border)] text-[var(--warning)]", restricted: "bg-rose-50 text-[var(--danger)]" };

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Resource Catalog</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Governed data sources — every resource has a connector, classification, and grants (§4.1, §6.2)
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{RESOURCES.length} Governed Resources</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Resource", "Type", "Classification", "Connector", "Grants", "Tags"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((r) => (
              <tr key={r.id} className="border-b transition-colors hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3.5">
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{r.externalRef}</div>
                </td>
                <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${TYPE_STYLES[r.type] ?? ""}`}>{r.type}</span></td>
                <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${CLASS_STYLES[r.classification] ?? ""}`}>{r.classification}</span></td>
                <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.connector}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: "var(--text-primary)" }}>{r.grants}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>{t}</span>
                    ))}
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
