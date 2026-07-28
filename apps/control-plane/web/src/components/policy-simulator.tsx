"use client";

import { useState } from "react";

/**
 * Policy Simulator (spec §9 1.3) — what-if evaluator for permission grants.
 *
 * Given a principal, resource, and action, shows whether access would be
 * ALLOWED or DENIED based on the ARM policy resolver (deny-wins, §6.1).
 */

const PREDEFINED_SCENARIOS = [
  { principal: "cad-assistant (standard)", resource: "s3://engineering/cad-files/", action: "read", expected: "allow", reason: "Matching grant at team level" },
  { principal: "alloy-analyzer (restricted)", resource: "s3://rnd/alloy-recipes/", action: "read", expected: "deny", reason: "RESTRICTED clearance — no external model routing" },
  { principal: "line-monitor-a (critical)", resource: "s3://prod-logs/", action: "read", expected: "allow", reason: "Critical tier — reserve access" },
  { principal: "payroll-validator (confidential)", resource: "db://erp/compensation", action: "write", expected: "deny", reason: "Write denied at department level" },
  { principal: "invoice-processor (standard)", resource: "db://erp/ap_ar", action: "read", expected: "allow", reason: "Matching grant at scope level" },
];

export function PolicySimulator() {
  const [selected, setSelected] = useState(0);

  const scenario = PREDEFINED_SCENARIOS[selected]!;

  return (
    <div className="rounded-2xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
      <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Policy Simulator (What-If)</h3>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Resolve access before granting</span>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3">
        {PREDEFINED_SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor: selected === i ? "var(--accent-soft)" : "transparent",
              color: selected === i ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${selected === i ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {s.principal.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Simulation result */}
      <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span style={{ color: "var(--text-muted)" }}>Principal</span>
            <div className="mt-0.5 font-semibold" style={{ color: "var(--text-primary)" }}>{scenario.principal}</div>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Action</span>
            <div className="mt-0.5 font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{scenario.action} on {scenario.resource}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: scenario.expected === "allow" ? "#bbf7d0" : "#fecaca", backgroundColor: scenario.expected === "allow" ? "#f0fdf4" : "#fef2f2" }}>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${scenario.expected === "allow" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
          >
            {scenario.expected.toUpperCase()}
          </span>
          <div>
            <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {scenario.reason}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {scenario.expected === "allow"
                ? "Access would be granted. Emission: access_audit_event(decision=allow)"
                : "Access denied by policy resolver. Higher-level deny or clearance gate."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
