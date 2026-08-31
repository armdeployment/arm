"use client";

/**
 * Stall breakdown panel (guide 02 §2): ranked horizontal bars of
 * `step × error_code`, plain-language labels ("38 stalled connecting
 * Jira"), never raw codes.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DeferredShell, type PanelStatus } from "../deferred-shell";
import { trpc } from "../../lib/trpc/client";
import type { ScopeRef } from "../../lib/use-scope";

export interface StallRow {
  step: string;
  errorCode: string;
  label: string;
  count: number;
  share: number;
}

export interface StallsPanelViewProps {
  status: PanelStatus;
  rows?: StallRow[];
  freshnessMs?: number;
  sampleData?: boolean;
  errorMessage?: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "6px",
  fontSize: "12px",
  color: "#0F172A",
  padding: "8px 12px",
} as const;

export function StallsPanelView({
  status,
  rows,
  freshnessMs,
  sampleData,
  errorMessage,
}: StallsPanelViewProps) {
  const isEmpty = status === "ready" && (!rows || rows.length === 0);
  const effectiveStatus: PanelStatus = status === "ready" && isEmpty ? "empty" : status;
  const chartData = rows?.map((r) => ({ ...r, name: `${r.label} (${r.count})` })) ?? [];

  return (
    <DeferredShell
      title="Where Adoption Stalls"
      subtitle="step × cause, plain-language"
      status={effectiveStatus}
      minHeight={320}
      errorMessage={errorMessage}
      emptyMessage="No stalls in this window — funnel is converting cleanly."
      freshnessMs={freshnessMs}
      sampleData={sampleData}
    >
      {rows && (
        <>
          <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
            >
              <XAxis
                type="number"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={220}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "#F1F5F9" }}
                formatter={(value, _name, item) => {
                  const payload = (item as { payload?: StallRow & { name: string } })?.payload;
                  return [`${value} users (${payload?.share ?? 0}%)`, payload?.label ?? ""];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#B91C1C" : "#B45309"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <table className="sr-only">
            <caption>Adoption stalls — step, cause, count, share</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Cause</th>
                <th scope="col">Count</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.step}:${r.errorCode}`}>
                  <td>{r.step}</td>
                  <td>{r.label}</td>
                  <td>{r.count}</td>
                  <td>{r.share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DeferredShell>
  );
}

export function StallsPanel({
  scope,
  jobFunctionKey,
}: {
  scope: ScopeRef;
  jobFunctionKey?: string | null;
}) {
  const q = trpc.adoption.stalls.useQuery({ scope, jobFunctionKey: jobFunctionKey ?? null });

  if (q.isLoading) return <StallsPanelView status="loading" />;
  if (q.isError) return <StallsPanelView status="error" errorMessage={q.error?.message} />;

  return (
    <StallsPanelView
      status="ready"
      rows={q.data!.rows}
      freshnessMs={q.data!.meta.ledgerFreshnessMs}
      sampleData={q.data!.meta.sampleData}
    />
  );
}
