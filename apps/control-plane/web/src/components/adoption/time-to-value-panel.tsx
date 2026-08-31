"use client";

/**
 * Time-to-value panel (guide 02 §2): histogram of questionnaire-start ->
 * first-metered-call, p50/p90 markers, target line at 10 min.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { DeferredShell, type PanelStatus } from "../deferred-shell";
import { trpc } from "../../lib/trpc/client";
import type { ScopeRef } from "../../lib/use-scope";

export interface TTVBucket {
  ltMinutes: number;
  count: number;
}

export interface TimeToValuePanelViewProps {
  status: PanelStatus;
  buckets?: TTVBucket[];
  p50?: number;
  p90?: number;
  targetMinutes?: number;
  sampleCount?: number;
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

function bucketLabel(b: TTVBucket, prev: number): string {
  return b.ltMinutes === Infinity ? `>${prev}m` : `${prev}–${b.ltMinutes}m`;
}

export function TimeToValuePanelView({
  status,
  buckets,
  p50,
  p90,
  targetMinutes = 10,
  sampleCount,
  freshnessMs,
  sampleData,
  errorMessage,
}: TimeToValuePanelViewProps) {
  const isEmpty = status === "ready" && (!sampleCount || sampleCount === 0);
  const effectiveStatus: PanelStatus = status === "ready" && isEmpty ? "empty" : status;

  let prev = 0;
  const chartData = (buckets ?? []).map((b) => {
    const label = bucketLabel(b, prev);
    prev = b.ltMinutes;
    return { ...b, label };
  });

  return (
    <DeferredShell
      title="Time to Value"
      subtitle={`questionnaire start → first metered call · target ${targetMinutes} min`}
      status={effectiveStatus}
      minHeight={300}
      errorMessage={errorMessage}
      emptyMessage="No completed activations to measure yet."
      freshnessMs={freshnessMs}
      sampleData={sampleData}
    >
      {buckets && (
        <>
          <div className="mb-2 flex gap-4 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <span>
              p50: <strong style={{ color: "var(--text-primary)" }}>{p50}m</strong>
            </span>
            <span>
              p90: <strong style={{ color: "var(--text-primary)" }}>{p90}m</strong>
            </span>
            <span>
              n = <strong style={{ color: "var(--text-primary)" }}>{sampleCount}</strong>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <XAxis
                dataKey="label"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                {chartData.map((b, i) => (
                  <Cell key={i} fill={b.ltMinutes <= targetMinutes ? "#15803D" : "#1E3A8A"} />
                ))}
              </Bar>
              {typeof p50 === "number" && (
                <ReferenceLine
                  x={chartData.find((b) => p50! <= b.ltMinutes)?.label}
                  stroke="#B45309"
                  strokeDasharray="4 3"
                  label={{ value: "p50", fontSize: 10, fill: "#B45309" }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>

          <table className="sr-only">
            <caption>Time to value histogram — bucket, count</caption>
            <thead>
              <tr>
                <th scope="col">Bucket</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td>{b.count}</td>
                </tr>
              ))}
              <tr>
                <td>p50</td>
                <td>{p50}m</td>
              </tr>
              <tr>
                <td>p90</td>
                <td>{p90}m</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </DeferredShell>
  );
}

export function TimeToValuePanel({
  scope,
  jobFunctionKey,
}: {
  scope: ScopeRef;
  jobFunctionKey?: string | null;
}) {
  const q = trpc.adoption.timeToValue.useQuery({ scope, jobFunctionKey: jobFunctionKey ?? null });

  if (q.isLoading) return <TimeToValuePanelView status="loading" />;
  if (q.isError) return <TimeToValuePanelView status="error" errorMessage={q.error?.message} />;

  return (
    <TimeToValuePanelView
      status="ready"
      buckets={q.data!.buckets}
      p50={q.data!.p50}
      p90={q.data!.p90}
      targetMinutes={q.data!.targetMinutes}
      sampleCount={q.data!.sampleCount}
      freshnessMs={q.data!.meta.ledgerFreshnessMs}
      sampleData={q.data!.meta.sampleData}
    />
  );
}
