"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = {
  claude: "#a855f7",
  gpt: "#3b82f6",
  glm: "#22c55e",
};

export interface SpendTrendPoint {
  date: string;
  claude: number;
  gpt: number;
  glm: number;
}

export interface ModelSpendItem {
  model: string;
  provider: string;
  spend: number;
  kind: "closed" | "self_hosted";
}

export interface TierItem {
  tier: string;
  count: number;
  color: string;
}

// ── Spend trend (area chart) ───────────────────────────────────────────────

export function SpendTrendChart({ data }: { data: SpendTrendPoint[] }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <h3 className="mb-4 text-sm font-semibold">Spend Trend (30 days)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gClaude" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.claude} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_COLORS.claude} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gGpt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.gpt} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_COLORS.gpt} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gGlm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.glm} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_COLORS.glm} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="claude"
            stroke={CHART_COLORS.claude}
            fill="url(#gClaude)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="gpt"
            stroke={CHART_COLORS.gpt}
            fill="url(#gGpt)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="glm"
            stroke={CHART_COLORS.glm}
            fill="url(#gGlm)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-4 text-xs">
        {Object.entries(CHART_COLORS).map(([k, v]) => (
          <span
            key={k}
            className="flex items-center gap-1.5 capitalize"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v }} /> {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Model spend (horizontal bar chart) ─────────────────────────────────────

export function ModelSpendChart({ data }: { data: ModelSpendItem[] }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <h3 className="mb-4 text-sm font-semibold">Spend by Model</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="model"
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.kind === "self_hosted" ? "#22c55e" : "#3b82f6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} /> Closed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} /> Self-hosted
        </span>
      </div>
    </div>
  );
}

// ── Tier breakdown (donut chart) ───────────────────────────────────────────

export function TierBreakdownChart({ data }: { data: TierItem[] }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <h3 className="mb-4 text-sm font-semibold">Agents by Priority Tier</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="tier"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 text-xs">
        {data.map((t) => (
          <span
            key={t.tier}
            className="flex items-center gap-1.5 capitalize"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.tier} ({t.count})
          </span>
        ))}
      </div>
    </div>
  );
}
