"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { AgentRow } from "../lib/mock-data";

const columnHelper = createColumnHelper<AgentRow>();

const TIER_STYLES: Record<string, string> = {
  critical: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
  standard: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
  background: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  throttled: "bg-amber-500",
  disabled: "bg-slate-400",
};

const columns = [
  columnHelper.accessor("name", {
    header: "Agent",
    cell: (info) => (
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold"
          style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {info.getValue().slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{info.getValue()}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{info.row.original.id}</div>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("tier", {
    header: "Tier",
    cell: (info) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLES[info.getValue()] ?? ""}`}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("stakeholder", {
    header: "Stakeholder",
    cell: (info) => <span className="font-medium" style={{ color: "var(--text-secondary)" }}>@{info.getValue()}</span>,
  }),
  columnHelper.accessor("scope", {
    header: "Scope",
    cell: (info) => <span style={{ color: "var(--text-secondary)" }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("taskType", {
    header: "Task",
    cell: (info) => <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("monthlySpend", {
    header: "Monthly $",
    cell: (info) => (
      <span className="font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        ${info.getValue().toLocaleString()}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <span className="flex items-center gap-2 text-xs font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[info.getValue()] ?? "bg-slate-300"}`} />
        {info.getValue()}
      </span>
    ),
  }),
];

export function AgentsTable({ data }: { data: AgentRow[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Top Agents by Spend</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {data.length} agents
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} style={{ borderBottom: "1px solid var(--border)" }}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-slate-50" style={{ borderBottom: "1px solid var(--border)" }}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-5 py-3.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
