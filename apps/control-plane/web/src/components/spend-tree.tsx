"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { trpc } from "../lib/trpc/client";
import { scopeUrl } from "../lib/use-scope";

// ── Shared types ───────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  type: string;
  monthlySpend: number;
  agentCount: number;
  budgetCap: number;
  budgetUtilPct: number;
  criticalCount: number;
  children: TreeNode[];
}

// ── Color palette by tree depth (blue theme) ──────────────────────────────

const DEPTH_COLORS = [
  "#2563eb", // dept  — blue-600
  "#3b82f6", // group — blue-500
  "#60a5fa", // team  — blue-400
  "#93c5fd", // ws    — blue-300
];

const CRIT_COLOR = "#e11d48"; // rose-600 for critical agents

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
  padding: "10px 14px",
} as const;

// ── Treemap ────────────────────────────────────────────────────────────────

/** Transforms TreeNode[] into Recharts Treemap data format. */
function toTreemapData(nodes: TreeNode[]): any[] {
  return nodes.map((n) => {
    const base: Record<string, unknown> = {
      name: n.name,
      size: n.monthlySpend,
      type: n.type,
      agentCount: n.agentCount,
      budgetUtilPct: n.budgetUtilPct,
      criticalCount: n.criticalCount,
      id: n.id,
    };
    if (n.children.length > 0) {
      base.children = toTreemapData(n.children);
    }
    return base;
  });
}

/** Custom content renderer for treemap cells. */
function TreemapCell(props: any) {
  const { x, y, width, height, name, size, depth, criticalCount, index } = props;
  if (width < 2 || height < 2) return null;

  const fill = criticalCount > 0 ? CRIT_COLOR : DEPTH_COLORS[Math.min(depth - 1, DEPTH_COLORS.length - 1)];
  const opacity = 0.85 + (depth === 1 ? 0.15 : 0);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={fill}
        opacity={opacity}
        stroke="#ffffff"
        strokeWidth={2}
      />
      {width > 80 && height > 40 && (
        <>
          <text x={x + 8} y={y + 18} fill="#ffffff" fontSize={12} fontWeight={700}>
            {name}
          </text>
          <text x={x + 8} y={y + 34} fill="rgba(255,255,255,0.85)" fontSize={11}>
            ${size?.toLocaleString()}/mo
          </text>
        </>
      )}
      {width > 40 && width <= 80 && height > 20 && (
        <text x={x + 6} y={y + 16} fill="#ffffff" fontSize={10} fontWeight={600}>
          {name.length > 8 ? name.slice(0, 7) + "…" : name}
        </text>
      )}
    </g>
  );
}

export function SpendTreemap() {
  const { data, isLoading } = trpc.orgTree.fullTree.useQuery();

  if (isLoading || !data) {
    return (
      <ChartCard title="Spend by Org Tree (Treemap)">
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </ChartCard>
    );
  }

  const treeData = toTreemapData(data.tree.children);

  return (
    <ChartCard title="Spend by Org Tree">
      <ResponsiveContainer width="100%" height={340}>
        <Treemap
          data={treeData}
          dataKey="size"
          nameKey="name"
          aspectRatio={4 / 3}
          stroke="#ffffff"
          content={<TreemapCell />}
        >
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div style={TOOLTIP_STYLE}>
                  <div className="font-bold" style={{ color: "var(--text-primary)" }}>{d.name}</div>
                  <div className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div>Spend: <strong>${d.size?.toLocaleString()}/mo</strong></div>
                    <div>Agents: {d.agentCount}</div>
                    <div>Type: {d.type}</div>
                    {d.criticalCount > 0 && <div className="font-semibold" style={{ color: CRIT_COLOR }}>{d.criticalCount} critical</div>}
                  </div>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: DEPTH_COLORS[0] }} /> Department
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: DEPTH_COLORS[1] }} /> Group
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: DEPTH_COLORS[2] }} /> Team
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: CRIT_COLOR }} /> Has critical agents
        </span>
      </div>
    </ChartCard>
  );
}

// ── Indented Tree View ─────────────────────────────────────────────────────

const INDENT_PX = 24;

function TreeRow({
  node,
  depth,
  isLast,
}: {
  node: TreeNode;
  depth: number;
  isLast: boolean;
}) {
  const color = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  const isDept = depth === 1;

  return (
    <>
      <a
        href={scopeUrl({ type: node.type as "org" | "department" | "group" | "team", id: node.id })}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
        style={{ paddingLeft: `${12 + depth * INDENT_PX}px` }}
      >
        {/* Connector line */}
        {depth > 0 && (
          <div
            className="absolute -ml-1 h-full border-l border-dashed"
            style={{ borderColor: "var(--border)", left: `${depth * INDENT_PX - 10}px`, top: "-10px", bottom: "-10px" }}
          />
        )}

        {/* Dot indicator */}
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: node.criticalCount > 0 ? CRIT_COLOR : color }}
        />

        {/* Name + type */}
        <div className="min-w-0 flex-1">
          <span
            className={isDept ? "font-semibold" : "font-medium"}
            style={{ color: "var(--text-primary)" }}
          >
            {node.name}
          </span>
          <span className="ml-2 text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
            {node.type}
          </span>
        </div>

        {/* Stats */}
        <div className="flex shrink-0 items-center gap-4 text-right">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {node.agentCount} agent{node.agentCount !== 1 ? "s" : ""}
          </span>
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: node.budgetUtilPct > 80 ? "var(--danger)" : "var(--text-secondary)" }}
          >
            {node.budgetUtilPct}%
          </span>
          <span className="w-24 text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            ${node.monthlySpend.toLocaleString()}
          </span>
        </div>
      </a>
      {node.children.length > 0 &&
        node.children.map((child, i) => (
          <TreeRow key={child.id} node={child} depth={depth + 1} isLast={i === node.children.length - 1} />
        ))}
    </>
  );
}

export function SpendTreeView() {
  const { data, isLoading } = trpc.orgTree.fullTree.useQuery();

  if (isLoading || !data) {
    return (
      <ChartCard title="Spend Tree">
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Spend by Org Tree (Full Hierarchy)">
      <div className="space-y-0">
        {/* Root row */}
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 font-bold" style={{ color: "var(--text-primary)" }}>
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: DEPTH_COLORS[0] }} />
          <div className="flex-1">{data.tree.name}</div>
          <div className="flex items-center gap-4 text-right">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {data.tree.agentCount} agents
            </span>
            <span className="w-24 text-sm tabular-nums">
              ${data.tree.monthlySpend.toLocaleString()}/mo
            </span>
          </div>
        </div>
        {/* Tree */}
        <div className="mt-1">
          {data.tree.children.map((child, i) => (
            <TreeRow key={child.id} node={child} depth={1} isLast={i === data.tree.children.length - 1} />
          ))}
        </div>
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
