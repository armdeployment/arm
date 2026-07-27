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
  claude: "#6366f1",  // indigo-500
  gpt: "#2563eb",     // blue-600
  glm: "#06b6d4",     // cyan-500
};

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
  padding: "8px 12px",
} as const;

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

export function SpendTrendChart({ data }: { data: SpendTrendPoint[] }) {
  return (
    <ChartCard title="Spend Trend (30 days)">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            {Object.entries(CHART_COLORS).map(([k, v]) => (
              <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={v} stopOpacity={0.25} />
                <stop offset="100%" stopColor={v} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="claude" stroke={CHART_COLORS.claude} fill={`url(#g-claude)`} strokeWidth={2.5} />
          <Area type="monotone" dataKey="gpt" stroke={CHART_COLORS.gpt} fill={`url(#g-gpt)`} strokeWidth={2.5} />
          <Area type="monotone" dataKey="glm" stroke={CHART_COLORS.glm} fill={`url(#g-glm)`} strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
      <ChartLegend items={[
        { label: "Claude", color: CHART_COLORS.claude },
        { label: "GPT", color: CHART_COLORS.gpt },
        { label: "GLM", color: CHART_COLORS.glm },
      ]} />
    </ChartCard>
  );
}

export function ModelSpendChart({ data }: { data: ModelSpendItem[] }) {
  return (
    <ChartCard title="Spend by Model">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="model" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={110} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="spend" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.kind === "self_hosted" ? "#06b6d4" : "#2563eb"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend items={[
        { label: "Closed", color: "#2563eb" },
        { label: "Self-hosted", color: "#06b6d4" },
      ]} />
    </ChartCard>
  );
}

export function TierBreakdownChart({ data }: { data: TierItem[] }) {
  return (
    <ChartCard title="Agents by Priority Tier">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="tier" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-5">
        {data.map((t) => (
          <span key={t.tier} className="flex items-center gap-2 text-xs font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.tier} ({t.count})
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

// ── Shared card wrapper ────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <h3 className="mb-5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      {children}
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-4 flex gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
