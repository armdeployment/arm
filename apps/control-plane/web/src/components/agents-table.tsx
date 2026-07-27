"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { agents, type AgentRow } from "../lib/mock-data";

const columnHelper = createColumnHelper<AgentRow>();

const TIER_STYLES: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-400",
  standard: "bg-blue-500/15 text-blue-400",
  background: "bg-green-500/15 text-green-400",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  throttled: "bg-amber-500",
  disabled: "bg-zinc-500",
};

const columns = [
  columnHelper.accessor("name", {
    header: "Agent",
    cell: (info) => (
      <div>
        <div className="font-medium">{info.getValue()}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {info.row.original.id}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("tier", {
    header: "Tier",
    cell: (info) => (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${TIER_STYLES[info.getValue()]}`}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("stakeholder", {
    header: "Stakeholder",
    cell: (info) => <span style={{ color: "var(--text-secondary)" }}>@{info.getValue()}</span>,
  }),
  columnHelper.accessor("scope", {
    header: "Scope",
    cell: (info) => <span style={{ color: "var(--text-secondary)" }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("monthlySpend", {
    header: "Monthly $",
    cell: (info) => <span className="font-mono font-medium">${info.getValue().toLocaleString()}</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <span className="flex items-center gap-1.5 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[info.getValue()]}`} />
        {info.getValue()}
      </span>
    ),
  }),
];

export function AgentsTable({ data = agents }: { data?: AgentRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold">Top Agents by Spend</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b" style={{ borderColor: "var(--border)" }}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
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
            <tr
              key={row.id}
              className="border-b transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)" }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-5 py-3">
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
