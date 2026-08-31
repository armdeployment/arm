"use client";

import { trpc } from "../lib/trpc/client";

export function ModelPolicyPanel() {
  const { data: rules } = trpc.policy.modelRules.useQuery();
  const { data: compliance } = trpc.policy.scopeCompliance.useQuery({ scope: null });

  if (!rules || !compliance) {
    return (
      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold">Model Access Policy</h3>
        <div className="h-20 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Model Access Policy (DLP Gate §6.5)
        </h3>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
          {compliance.restrictedAgents} restricted agents
        </span>
      </div>

      {/* Clearance rules */}
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
        {rules.rules.map((rule) => (
          <div
            key={rule.clearance}
            className={`rounded-md border p-3 ${
              rule.allowedKinds.length === 1
                ? "border-amber-200 bg-amber-50/50"
                : "border-green-200 bg-green-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold capitalize"
                style={{ color: "var(--text-primary)" }}
              >
                {rule.clearance}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  rule.allowedKinds.length === 1
                    ? "bg-amber-100 text-[var(--warning)]"
                    : "bg-green-100 text-[var(--success)]"
                }`}
              >
                {rule.allowedKinds.length === 1 ? "RESTRICTED" : "OPEN"}
              </span>
            </div>
            <div
              className="mt-1.5 text-[10px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {rule.description}
            </div>
          </div>
        ))}
      </div>

      {/* Blocked models */}
      <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Blocked Models
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {compliance.blockedModels.map((m) => (
            <div
              key={m.model}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 ring-1 ring-red-200"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {m.model}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                ({m.provider})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Available models */}
      <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Available for All Clearances
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {compliance.availableModels.map((m) => (
            <div
              key={m.model}
              className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-200"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {m.model}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                ({m.provider})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
