"use client";

import { trpc } from "../../../lib/trpc/client";

// ── Icons ─────────────────────────────────────────────────────────────────

const SCOPE_ICONS: Record<string, string> = {
  org: "🏛️",
  organization: "🏛️",
  hq: "🏢",
  plant: "🏭",
  department: "📁",
};

const VERB_LABELS: Record<string, string> = {
  "org_node:create": "Create nodes",
  "org_node:rename": "Rename nodes",
  "org_node:reparent": "Reparent nodes",
  "org_node:delete": "Delete nodes",
  "*": "Full access",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function RolesAdminPage() {
  const roles = trpc.roles.list.useQuery();
  const perms = trpc.roles.permissions.useQuery();

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Roles & Permissions
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Configure who can restructure the org tree. Role presets are seeded by your industry profile
          at provisioning time — you can edit them, clone them, or create custom roles. This is the D8
          permission model: capability-based, not title-based.
        </p>
      </div>

      {/* D8 explanation banner */}
      <div
        className="mb-6 rounded-lg p-4"
        style={{ backgroundColor: "var(--navy-light)", borderLeft: "3px solid var(--navy)" }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg">🔐</span>
          <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>
            <strong>How authority works:</strong> Every org-tree edit is one of four verbs —{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--navy)" }}>create</code>,{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--navy)" }}>rename</code>,{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--red)" }}>reparent</code>,{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--red)" }}>delete</code>.{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--red)" }}>reparent</code> and{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--red)" }}>delete</code> are
            org-admin-only. Your VP/Director/Manager titles map to these roles — the mapping is
            configuration you control.
          </div>
        </div>
      </div>

      {/* Two-column: role presets + permission legend */}
      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Role presets */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Role Presets ({roles.data?.roles.length ?? 0})
          </h2>
          {roles.isLoading ? (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading roles…</div>
          ) : (
            <div className="space-y-3">
              {roles.data?.roles.map((role: { key: string; label: string; description: string; scopeType: string; permissions: string[]; singleton: boolean }) => (
                <RoleCard key={role.key} role={role} />
              ))}
            </div>
          )}

          {/* Create custom role */}
          <button
            className="mt-4 w-full rounded-lg border border-dashed py-3 text-[13px] font-medium transition-colors hover:bg-[var(--navy-light)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            ＋ Create custom role
          </button>
        </div>

        {/* Permission legend */}
        <div className="space-y-4">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Org-Node Verbs
            </h2>
            <div className="space-y-2">
              {perms.data?.verbs.map((verb: { key: string; label: string; description: string }) => (
                <div
                  key={verb.key}
                  className="rounded-lg border p-3"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-[11px] font-mono" style={{ color: "var(--navy)" }}>
                      {verb.key}
                    </code>
                    {(verb.key.includes("reparent") || verb.key.includes("delete")) && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                        style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "var(--red)" }}
                      >
                        Admin only
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {verb.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Authority flow */}
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <h3 className="mb-2 text-[11px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Authority Flow
            </h3>
            <div className="space-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <div>🏛️ <strong>Org Admin</strong> → all verbs, all scopes</div>
              <div className="pl-3">↓ delegates create + rename</div>
              <div>🏛️ <strong>Subsidiary Admin</strong> → within subsidiary</div>
              <div className="pl-3">↓ delegates create + rename</div>
              <div>🏭 <strong>Plant Manager</strong> → within plant</div>
              <div className="pl-3">↓</div>
              <div>📁 <strong>Dept Head</strong> → rename own dept</div>
              <div className="pl-3">↓</div>
              <div>👤 <strong>Viewer</strong> → read-only</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────────────────

function RoleCard({ role }: {
  role: {
    key: string;
    label: string;
    description: string;
    scopeType: string;
    permissions: string[];
    singleton: boolean;
  };
}) {
  const icon = SCOPE_ICONS[role.scopeType] ?? "📁";
  const isAdmin = role.key === "org_admin";
  const orgNodePerms = role.permissions.filter((p) => p.startsWith("org_node:"));

  return (
    <div
      className="rounded-lg border p-4 transition-shadow hover:shadow-md"
      style={{ borderColor: isAdmin ? "var(--navy)" : "var(--border)", backgroundColor: "var(--surface)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{role.label}</span>
              <code className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{role.key}</code>
              {role.singleton && (
                <span
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                  style={{ backgroundColor: "var(--navy-light)", color: "var(--navy)" }}
                >
                  Singleton
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {role.description}
            </p>
          </div>
        </div>
        <button
          className="rounded px-2 py-1 text-[10px] font-medium transition-colors hover:bg-[var(--navy-light)]"
          style={{ color: "var(--text-secondary)" }}
        >
          Edit
        </button>
      </div>

      {/* Permissions */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {orgNodePerms.length === 0 && (
          <span className="text-[10px] italic" style={{ color: "var(--text-muted)" }}>
            No org-tree permissions (read-only)
          </span>
        )}
        {orgNodePerms.map((perm) => {
          const isDanger = perm.includes("reparent") || perm.includes("delete");
          return (
            <span
              key={perm}
              className="rounded px-2 py-0.5 text-[9px] font-mono"
              style={{
                backgroundColor: isDanger ? "rgba(220,38,38,0.08)" : "rgba(37,99,235,0.08)",
                color: isDanger ? "var(--red)" : "var(--navy)",
              }}
            >
              {VERB_LABELS[perm] ?? perm}
            </span>
          );
        })}
        {role.permissions.includes("*") && (
          <span
            className="rounded px-2 py-0.5 text-[9px] font-mono font-bold"
            style={{ backgroundColor: "var(--gold-light)", color: "var(--gold)" }}
          >
            FULL ACCESS
          </span>
        )}
      </div>

      {/* Scope */}
      <div className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
        Scope: <code className="font-mono">{role.scopeType}</code>
        {role.scopeType !== "org" && " (per-node: grant to specific plants/depts)"}
      </div>
    </div>
  );
}
