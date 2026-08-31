"use client";

/**
 * /adoption — the primary panel (docs/guides/02-server-panels.md §2).
 *
 * A1 (locked assumption): agent adoption at scale is the PRIMARY value prop.
 * This page answers "how much of the company is actually using agents,
 * where is adoption stalling, and what is blocking it" — cost lives on
 * /spend, reframed as a secondary story (guide 02 §1).
 */

import { Suspense, useState } from "react";
import { ScopeBreadcrumb } from "../../components/breadcrumb";
import { StatCard } from "../../components/stat-card";
import { FunnelPanel } from "../../components/adoption/funnel-panel";
import { StallsPanel } from "../../components/adoption/stalls-panel";
import { TimeToValuePanel } from "../../components/adoption/time-to-value-panel";
import { CoveragePanel } from "../../components/adoption/coverage-panel";
import { GapsPanel } from "../../components/adoption/gaps-panel";
import { RecentActivationsPanel } from "../../components/adoption/recent-activations-panel";
import { useScope } from "../../lib/use-scope";
import { trpc } from "../../lib/trpc/client";

const JOB_FUNCTION_OPTIONS = [
  { key: "", label: "All job functions" },
  { key: "quality_engineer", label: "Quality Engineer" },
  { key: "plc_programmer", label: "PLC Programmer" },
  { key: "maintenance_technician", label: "Maintenance Technician" },
  { key: "office_worker_general", label: "Office Worker (General)" },
  { key: "exec_assistant", label: "Executive Assistant" },
  { key: "material_planner", label: "Material Planner" },
  { key: "process_engineer", label: "Process Engineer (gap)" },
];

export default function AdoptionPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-64 animate-pulse rounded-lg border bg-[var(--bg-elevated)]"
          style={{ borderColor: "var(--border)" }}
        />
      }
    >
      <AdoptionPageContent />
    </Suspense>
  );
}

function AdoptionPageContent() {
  const scope = useScope();
  const [jobFunctionKey, setJobFunctionKey] = useState<string>("");
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const active = trpc.adoption.activeUsers.useQuery({
    scope,
    jobFunctionKey: jobFunctionKey || null,
  });

  return (
    <div className="space-y-6 p-8">
      <div>
        <ScopeBreadcrumb scope={scope} />
        <h1
          className="mt-2 text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Adoption
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Activation funnel, stalls, time-to-value, coverage, and gaps — the product&apos;s report
          card (A1: adoption at scale is the primary value prop)
        </p>
      </div>

      {/* Filter bar — department (via scope), job function, date range (guide 02 §2) */}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className="flex items-center gap-2 text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Job function
          <select
            value={jobFunctionKey}
            onChange={(e) => setJobFunctionKey(e.target.value)}
            className="rounded-md border px-2 py-1 text-[12px]"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          >
            {JOB_FUNCTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {selectedStep && (
          <button
            type="button"
            onClick={() => setSelectedStep(null)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ backgroundColor: "var(--navy-light)", color: "var(--navy)" }}
          >
            Filtered to step: {selectedStep} ✕
          </button>
        )}
      </div>

      {/* Weekly-active headline stats — A1's primary metric */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Weekly Active"
          value={active.data ? String(active.data.weeklyActive) : "—"}
          sub="A1 primary metric"
          tone="success"
        />
        <StatCard
          label="Activated Seats"
          value={active.data ? String(active.data.activatedSeats) : "—"}
          sub="reached first metered call"
        />
        <StatCard
          label="Eligible Seats"
          value={active.data ? String(active.data.eligibleSeats) : "—"}
          sub="headcount with a published package"
        />
      </div>

      {/* Hero panel: funnel */}
      <FunnelPanel
        scope={scope}
        jobFunctionKey={jobFunctionKey}
        selectedStep={selectedStep}
        onStepClick={setSelectedStep}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StallsPanel scope={scope} jobFunctionKey={jobFunctionKey} />
        <TimeToValuePanel scope={scope} jobFunctionKey={jobFunctionKey} />
      </div>

      <CoveragePanel scope={scope} jobFunctionKey={jobFunctionKey} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GapsPanel />
        <RecentActivationsPanel scope={scope} jobFunctionKey={jobFunctionKey} step={selectedStep} />
      </div>
    </div>
  );
}
