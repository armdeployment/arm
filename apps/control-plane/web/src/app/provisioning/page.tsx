"use client";

import { useState } from "react";
import {
  techProfile,
  manufacturingProfile,
  financeProfile,
  holdingProfile,
  flattenOrgTree,
  countOrgNodes,
  countOrgNodesByType,
  type IndustryProfilePreset,
  type ProfileId,
  type OrgNodeSeed,
} from "@arm/profiles";

const PROFILES: Record<string, IndustryProfilePreset> = {
  tech: techProfile,
  manufacturing: manufacturingProfile,
  finance: financeProfile,
  holding: holdingProfile,
};

const PROFILE_ICONS: Record<string, string> = {
  tech: "💻",
  manufacturing: "🏭",
  finance: "🏦",
  holding: "🏛️",
};

export default function ProvisioningPage() {
  const [selected, setSelected] = useState<ProfileId>("manufacturing");
  const [tenantName, setTenantName] = useState("Acme Corp");
  const [step, setStep] = useState<"select" | "review" | "provisioned">("select");

  const profile = PROFILES[selected]!;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}>
        <div className="mx-auto max-w-5xl px-8 py-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center text-[18px] font-bold"
              style={{
                backgroundColor: "var(--navy)",
                color: "#fff",
                borderRadius: "var(--radius)",
              }}
            >
              A
            </div>
            <div>
              <h1
                className="text-[20px] font-semibold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Tenant Provisioning
              </h1>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Select an Industry Profile — sets defaults, never gates capabilities (D6)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-8 py-8">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-4">
          {(["select", "review", "provisioned"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className="flex h-7 w-7 items-center justify-center text-[12px] font-semibold"
                style={{
                  backgroundColor:
                    step === s ? "var(--navy)" : s < step ? "var(--green)" : "var(--bg)",
                  color: step === s || s < step ? "#fff" : "var(--text-secondary)",
                  borderRadius: "50%",
                  border: `1px solid ${step === s ? "var(--navy)" : "var(--border)"}`,
                }}
              >
                {s < step ? "✓" : i + 1}
              </div>
              <span
                className="text-[13px] font-medium"
                style={{ color: step === s ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                {s === "select"
                  ? "Select Profile"
                  : s === "review"
                    ? "Review Defaults"
                    : "Provisioned"}
              </span>
              {i < 2 && (
                <div className="mx-2 h-px w-12" style={{ backgroundColor: "var(--border)" }} />
              )}
            </div>
          ))}
        </div>

        {step === "select" && (
          <ProfileSelector
            selected={selected}
            onSelect={setSelected}
            tenantName={tenantName}
            onTenantName={setTenantName}
            onNext={() => setStep("review")}
          />
        )}

        {step === "review" && (
          <ProfileReview
            profile={profile}
            tenantName={tenantName}
            onBack={() => setStep("select")}
            onProvision={() => setStep("provisioned")}
          />
        )}

        {step === "provisioned" && <ProvisionedSummary profile={profile} tenantName={tenantName} />}
      </div>
    </div>
  );
}

// ── Step 1: Profile Selector ───────────────────────────────────────────────

function ProfileSelector({
  selected,
  onSelect,
  tenantName,
  onTenantName,
  onNext,
}: {
  selected: ProfileId;
  onSelect: (id: ProfileId) => void;
  tenantName: string;
  onTenantName: (name: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Tenant name */}
      <div
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}
      >
        <label className="mb-2 block label-meta">Tenant Name</label>
        <input
          value={tenantName}
          onChange={(e) => onTenantName(e.target.value)}
          className="w-full rounded border px-3 py-2 text-[14px]"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          placeholder="Acme Corp"
        />
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(PROFILES).map(([id, profile]) => (
          <button
            key={id}
            onClick={() => onSelect(id as ProfileId)}
            className="rounded-lg border p-5 text-left transition-all"
            style={{
              borderColor: selected === id ? "var(--navy)" : "var(--border)",
              backgroundColor: selected === id ? "var(--bg-hover)" : "#fff",
              borderWidth: selected === id ? "2px" : "1px",
            }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[28px]">{PROFILE_ICONS[id]}</span>
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {profile.label}
                </div>
                <div className="text-[12px] font-mono" style={{ color: "var(--gold)" }}>
                  {profile.id}
                </div>
              </div>
              {selected === id && (
                <span className="ml-auto text-[14px]" style={{ color: "var(--navy)" }}>
                  ✓
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {profile.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag>{countOrgNodes(profile.orgTree.nodes)} org nodes</Tag>
              <Tag>{profile.seedAgents.length} seed agents</Tag>
              <Tag>{profile.dlpPatterns.length} DLP patterns</Tag>
              <Tag>
                {profile.classification.axes.length === 2
                  ? "Dual-axis classification"
                  : "Single-axis classification"}
              </Tag>
            </div>
          </button>
        ))}
      </div>

      {/* Custom note */}
      <div className="rounded-lg border border-dashed p-4" style={{ borderColor: "var(--border)" }}>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>Custom</strong> — Start empty and
          configure every capability individually. Any tenant can enable any capability regardless
          of profile (D6 governing rule).
        </p>
      </div>

      {/* Next button */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white"
          style={{ backgroundColor: "var(--navy)" }}
        >
          Review Defaults →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Review what gets provisioned ────────────────────────────────────

function ProfileReview({
  profile,
  tenantName,
  onBack,
  onProvision,
}: {
  profile: IndustryProfilePreset;
  tenantName: string;
  onBack: () => void;
  onProvision: () => void;
}) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}
      >
        <h2 className="mb-1 text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
          What gets provisioned for {tenantName}
        </h2>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Profile:{" "}
          <span className="font-mono" style={{ color: "var(--gold)" }}>
            {profile.id}
          </span>{" "}
          — These are defaults. Everything can be changed after provisioning.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Departments / Org Tree (recursive tree view) */}
        <Section title="Organization Structure" subtitle={profile.orgTree.description}>
          <div className="space-y-0.5">
            {profile.orgTree.nodes.map((node, i) => (
              <OrgTreeNode key={i} node={node} depth={0} />
            ))}
          </div>
          <div className="mt-3 flex gap-3 text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {countOrgNodesByType(profile.orgTree.nodes, "plant") > 0 && (
              <span>📍 {countOrgNodesByType(profile.orgTree.nodes, "plant")} plants</span>
            )}
            {countOrgNodesByType(profile.orgTree.nodes, "organization") > 0 && (
              <span>
                🏛️ {countOrgNodesByType(profile.orgTree.nodes, "organization")} subsidiaries
              </span>
            )}
            <span>📊 {countOrgNodes(profile.orgTree.nodes)} total nodes</span>
          </div>
        </Section>

        {/* Classification */}
        <Section
          title="Classification Taxonomy"
          subtitle={`${profile.classification.axes.length === 2 ? "Dual-axis" : "Single-axis"} — sensitivity${profile.classification.axes.includes("regulatory") ? " + regulatory" : ""}`}
        >
          <div className="space-y-1.5">
            {profile.classification.levels.map((l) => (
              <div key={l.name} className="flex items-center justify-between text-[13px]">
                <span style={{ color: "var(--text-primary)" }}>
                  <span
                    className="font-mono text-[11px] mr-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    L{l.rank}
                  </span>
                  {l.name}
                </span>
                {l.regulatoryFlags.length > 0 && (
                  <div className="flex gap-1">
                    {l.regulatoryFlags.map((f) => (
                      <span
                        key={f}
                        className="rounded px-1.5 py-0.5 text-[10px] font-mono"
                        style={{ backgroundColor: "var(--critical-bg)", color: "var(--critical)" }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* DLP Patterns */}
        <Section
          title="DLP Patterns"
          subtitle={`${profile.dlpPatterns.length} patterns by category`}
        >
          <div className="flex flex-wrap gap-1.5">
            {profile.dlpPatterns.map((p) => (
              <span
                key={p.name}
                className="rounded px-2 py-1 text-[11px]"
                style={{
                  backgroundColor:
                    p.severity === "critical"
                      ? "var(--critical-bg)"
                      : p.severity === "warning"
                        ? "var(--warning-bg)"
                        : "var(--bg)",
                  color:
                    p.severity === "critical"
                      ? "var(--critical)"
                      : p.severity === "warning"
                        ? "var(--warning)"
                        : "var(--text-secondary)",
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </Section>

        {/* Resource Types */}
        <Section
          title="Resource Types"
          subtitle={`${profile.resourceTypes.enabled.length} types enabled`}
        >
          <div className="flex flex-wrap gap-1.5">
            {profile.resourceTypes.enabled.map((r) => (
              <span
                key={r}
                className="rounded px-2 py-0.5 text-[11px] font-mono"
                style={{ backgroundColor: "var(--bg)", color: "var(--text-secondary)" }}
              >
                {r}
              </span>
            ))}
          </div>
        </Section>

        {/* Seed Agents */}
        <Section
          title="Seed Agents"
          subtitle={`${profile.seedAgents.length} agents provisioned across departments`}
        >
          <div className="space-y-1">
            {profile.seedAgents.slice(0, 6).map((a) => (
              <div key={a.name} className="flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--text-primary)" }}>{a.name}</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {a.clearance} · {a.tier}
                </span>
              </div>
            ))}
            {profile.seedAgents.length > 6 && (
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                +{profile.seedAgents.length - 6} more...
              </div>
            )}
          </div>
        </Section>

        {/* UI Panels */}
        <Section
          title="Dashboard Panels"
          subtitle={`${profile.uiPanels.length} panels (registry-driven, not hardcoded)`}
        >
          <div className="flex flex-wrap gap-1.5">
            {profile.uiPanels.map((p) => (
              <span
                key={p.key}
                className="rounded px-2 py-0.5 text-[11px]"
                style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </Section>

        {/* Model Routing + Connectivity */}
        <Section title="Model Routing" subtitle={profile.modelRouting.description}>
          <div className="space-y-2">
            <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
              Strategy: <span className="font-mono">{profile.modelRouting.strategy}</span>
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
              Connectivity: <span className="font-mono">{profile.connectivity.assumption}</span>
              {profile.connectivity.offlinePolicyTtl && (
                <span className="ml-2 text-[11px]" style={{ color: "var(--gold)" }}>
                  + offline TTL
                </span>
              )}
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
              Stakeholder: <span className="font-mono">{profile.stakeholderRouting.mode}</span>
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
              Budget periods: <span className="font-mono">{profile.budgetPeriods.join(", ")}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border px-6 py-2.5 text-[14px] font-semibold"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          ← Back
        </button>
        <button
          onClick={onProvision}
          className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white"
          style={{ backgroundColor: "var(--navy)" }}
        >
          Provision Tenant →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Provisioned Summary ─────────────────────────────────────────────

function ProvisionedSummary({
  profile,
  tenantName,
}: {
  profile: IndustryProfilePreset;
  tenantName: string;
}) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-lg border p-6 text-center"
        style={{ borderColor: "var(--green)", backgroundColor: "#fff" }}
      >
        <div className="mb-3 text-[40px]">✓</div>
        <h2 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {tenantName} provisioned
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Industry Profile:{" "}
          <span className="font-mono" style={{ color: "var(--gold)" }}>
            {profile.id}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatBox value={countOrgNodes(profile.orgTree.nodes)} label="Org Nodes" />
        <StatBox value={profile.seedAgents.length} label="Seed Agents" />
        <StatBox value={profile.dlpPatterns.length} label="DLP Patterns" />
        <StatBox value={profile.resourceTypes.enabled.length} label="Resource Types" />
      </div>

      <div
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          All defaults have been materialized as per-tenant config rows. Runtime enforcement code
          reads config — never the profile id. The{" "}
          <code
            className="rounded px-1 py-0.5 text-[12px]"
            style={{ backgroundColor: "var(--bg)" }}
          >
            no-profile-branching
          </code>{" "}
          guardrail ensures this stays true.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="/"
            className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white"
            style={{ backgroundColor: "var(--navy)" }}
          >
            Go to Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// ── Recursive Org Tree Node ─────────────────────────────────────────────────

const NODE_ICONS: Record<string, string> = {
  organization: "🏛️",
  hq: "🏢",
  plant: "🏭",
  department: "▸",
  group: "·",
  line: "─",
  cell: "⋅",
};

const NODE_COLORS: Record<string, string> = {
  organization: "var(--navy)",
  hq: "var(--gold)",
  plant: "var(--green)",
  department: "var(--text-primary)",
};

function OrgTreeNode({ node, depth }: { node: OrgNodeSeed; depth: number }) {
  const icon = NODE_ICONS[node.type] ?? "·";
  const color = NODE_COLORS[node.type] ?? "var(--text-primary)";
  const isContainer = node.type === "organization" || node.type === "hq" || node.type === "plant";
  const budget = node.budgetMonthlyCents
    ? `$${(node.budgetMonthlyCents / 100).toLocaleString()}/mo`
    : "";

  return (
    <>
      <div
        className="flex items-center justify-between text-[12px]"
        style={{ paddingLeft: `${depth * 16}px`, fontWeight: isContainer ? 600 : 400 }}
      >
        <span style={{ color }}>
          <span className="mr-1">{icon}</span>
          {node.name}
          {node.location && (
            <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              📍 {node.location}
            </span>
          )}
          {node.tags?.regulatory && (
            <span
              className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-mono"
              style={{ backgroundColor: "var(--critical-bg)", color: "var(--critical)" }}
            >
              {node.tags.regulatory}
            </span>
          )}
        </span>
        {budget && (
          <span className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {budget}
          </span>
        )}
      </div>
      {node.children?.map((child, i) => (
        <OrgTreeNode key={i} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}
    >
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mb-3 mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-[11px]"
      style={{ backgroundColor: "var(--bg)", color: "var(--text-secondary)" }}
    >
      {children}
    </span>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="rounded-lg border p-4 text-center"
      style={{ borderColor: "var(--border)", backgroundColor: "#fff" }}
    >
      <div className="text-[28px] font-semibold" style={{ color: "var(--navy)" }}>
        {value}
      </div>
      <div className="label-meta mt-1">{label}</div>
    </div>
  );
}
