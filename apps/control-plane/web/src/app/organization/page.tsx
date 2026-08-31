"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../lib/trpc/client";
import { manufacturingProfile } from "@arm/profiles";
import type { OrgNodeSeed } from "@arm/profiles";

// ── Types ─────────────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  budgetCap: number;
  location?: string | null;
  tags?: Record<string, string>;
  children: TreeNode[];
}

// ── Icons per node type ────────────────────────────────────────────────────

const NODE_ICONS: Record<string, string> = {
  org: "🏛️",
  organization: "🏛️",
  hq: "🏢",
  plant: "🏭",
  department: "📁",
  group: "📂",
  line: "─",
  cell: "⋅",
  team: "👥",
  workstream: "▸",
};

const NODE_COLORS: Record<string, string> = {
  org: "var(--navy)",
  organization: "var(--navy)",
  hq: "var(--gold)",
  plant: "var(--green)",
  department: "var(--text-primary)",
};

const VERB_LABELS: Record<string, { label: string; icon: string; danger?: boolean }> = {
  create: { label: "Add Child", icon: "＋" },
  rename: { label: "Rename", icon: "✎" },
  reparent: { label: "Move", icon: "↗", danger: true },
  delete: { label: "Delete", icon: "✕", danger: true },
};

// ── Build a mutable tree from the profile (dev mode) ──────────────────────
// In production this comes from the departments table via tRPC orgTree.fullTree.

function buildTreeFromProfile(): TreeNode {
  function convert(seed: OrgNodeSeed, parentId: string | null, pathPrefix: string): TreeNode {
    const id = `${pathPrefix}/${seed.name}`.replace(/\s+/g, "_").toLowerCase();
    return {
      id,
      name: seed.name,
      type: seed.type,
      parentId,
      budgetCap: seed.budgetMonthlyCents ?? 0,
      location: seed.location ?? null,
      tags: seed.tags,
      children: (seed.children ?? []).map((c) => convert(c, id, id)),
    };
  }
  // The org root wraps all profile nodes
  const root: TreeNode = {
    id: "org_root",
    name: "Acme Manufacturing Corp",
    type: "org",
    parentId: null,
    budgetCap: 0,
    children: manufacturingProfile.orgTree.nodes.map((n) => convert(n, "org_root", "org_root")),
  };
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const [tree, setTree] = useState<TreeNode>(() => buildTreeFromProfile());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{ verb: string; node: TreeNode } | null>(null);
  const [auditLog, setAuditLog] = useState<{ verb: string; nodeName: string; timestamp: string }[]>(
    [],
  );

  const mutate = trpc.orgTree.mutate.useMutation();

  function findNode(node: TreeNode, id: string): TreeNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  function findAndRemove(node: TreeNode, id: string): TreeNode {
    return {
      ...node,
      children: node.children.filter((c) => c.id !== id).map((c) => findAndRemove(c, id)),
    };
  }

  function addChild(node: TreeNode, parentId: string, child: TreeNode): TreeNode {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, child] };
    }
    return { ...node, children: node.children.map((c) => addChild(c, parentId, child)) };
  }

  function renameNode(node: TreeNode, id: string, newName: string): TreeNode {
    if (node.id === id) return { ...node, name: newName };
    return { ...node, children: node.children.map((c) => renameNode(c, id, newName)) };
  }

  function handleVerb(verb: string, node: TreeNode) {
    if (verb === "delete") {
      if (node.children.length > 0) {
        alert("Cannot delete a node that has children. Remove children first.");
        return;
      }
      if (!confirm(`Delete "${node.name}"? This action is logged.`)) return;
      mutate.mutate({ verb: "delete", nodeId: node.id });
      setTree((t) => findAndRemove(t, node.id));
      setAuditLog((l) => [
        { verb: "delete", nodeName: node.name, timestamp: new Date().toISOString() },
        ...l,
      ]);
      setSelectedId(null);
      return;
    }
    setEditingNode({ verb, node });
  }

  function handleSaveCreate(
    parentNode: TreeNode,
    name: string,
    type: string,
    location: string,
    budget: number,
  ) {
    const newNode: TreeNode = {
      id: `${parentNode.id}/${name}`.replace(/\s+/g, "_").toLowerCase(),
      name,
      type,
      parentId: parentNode.id,
      budgetCap: budget,
      location: location || null,
      children: [],
    };
    mutate.mutate({
      verb: "create",
      parentId: parentNode.id,
      name,
      type: type as never,
      location,
      budgetMonthlyCents: budget,
    });
    setTree((t) => addChild(t, parentNode.id, newNode));
    setAuditLog((l) => [
      { verb: "create", nodeName: name, timestamp: new Date().toISOString() },
      ...l,
    ]);
    setEditingNode(null);
  }

  function handleSaveRename(node: TreeNode, newName: string) {
    mutate.mutate({ verb: "rename", nodeId: node.id, name: newName });
    setTree((t) => renameNode(t, node.id, newName));
    setAuditLog((l) => [
      {
        verb: "rename",
        nodeName: `${node.name} → ${newName}`,
        timestamp: new Date().toISOString(),
      },
      ...l,
    ]);
    setEditingNode(null);
  }

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Organization Structure
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Restructure your org tree as the company grows. Add plants, departments, subsidiaries.
          Changes are permission-checked (D8) and audit-logged.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        {/* Tree view */}
        <div
          className="rounded-lg border p-5"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Org Tree
            </h2>
            <div className="flex gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <span>{countNodes(tree)} nodes</span>
              <span>{countByType(tree, "plant")} plants</span>
              <span>{countByType(tree, "organization")} subsidiaries</span>
            </div>
          </div>

          {/* Tree */}
          <div className="space-y-0.5">
            <TreeRow
              node={tree}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onVerb={handleVerb}
              expandedAll
            />
          </div>
        </div>

        {/* Right panel: selected node details + actions */}
        <div className="space-y-4">
          {selectedNode ? (
            <NodeDetailPanel node={selectedNode} onVerb={handleVerb} />
          ) : (
            <div
              className="rounded-lg border border-dashed p-6 text-center"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Select a node to view details or restructure.
              </p>
            </div>
          )}

          {/* Audit log */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <h3
              className="mb-2 text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Recent Changes
            </h3>
            {auditLog.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                No changes yet. Edit the tree to see the audit trail.
              </p>
            ) : (
              <div className="space-y-1.5">
                {auditLog.slice(0, 8).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                      style={{
                        backgroundColor:
                          entry.verb === "delete" ? "rgba(220,38,38,0.1)" : "rgba(37,99,235,0.1)",
                        color: entry.verb === "delete" ? "var(--red)" : "var(--navy)",
                      }}
                    >
                      {entry.verb}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>{entry.nodeName}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingNode && (
        <EditModal
          state={editingNode}
          onCancel={() => setEditingNode(null)}
          onCreate={handleSaveCreate}
          onRename={handleSaveRename}
        />
      )}
    </div>
  );
}

// ── Tree row (recursive) ──────────────────────────────────────────────────

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  onVerb,
  expandedAll,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onVerb: (verb: string, node: TreeNode) => void;
  expandedAll?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isOpen = expandedAll ?? expanded;
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const icon = NODE_ICONS[node.type] ?? "·";
  const color = NODE_COLORS[node.type] ?? "var(--text-primary)";
  const isContainer = ["org", "organization", "hq", "plant"].includes(node.type);

  return (
    <>
      <div
        className="group flex cursor-pointer items-center justify-between rounded px-2 py-1 text-[13px] transition-colors"
        style={{
          paddingLeft: `${depth * 18 + 8}px`,
          backgroundColor: isSelected ? "var(--navy-light)" : "transparent",
          fontWeight: isContainer ? 600 : 400,
        }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center gap-1.5" style={{ color }}>
          {hasChildren && (
            <button
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!isOpen);
              }}
            >
              {isOpen ? "▼" : "▶"}
            </button>
          )}
          {!hasChildren && <span className="w-[10px]" />}
          <span>{icon}</span>
          <span>{node.name}</span>
          {node.location && (
            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              📍 {node.location}
            </span>
          )}
          {node.tags?.regulatory && (
            <span
              className="rounded px-1 py-0.5 text-[9px] font-mono"
              style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "var(--red)" }}
            >
              {node.tags.regulatory}
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionBtn
            label="＋"
            title="Add child"
            onClick={(e) => {
              e.stopPropagation();
              onVerb("create", node);
            }}
          />
          <ActionBtn
            label="✎"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              onVerb("rename", node);
            }}
          />
          <ActionBtn
            label="↗"
            title="Move"
            danger
            onClick={(e) => {
              e.stopPropagation();
              onVerb("reparent", node);
            }}
          />
          {node.id !== "org_root" && (
            <ActionBtn
              label="✕"
              title="Delete"
              danger
              onClick={(e) => {
                e.stopPropagation();
                onVerb("delete", node);
              }}
            />
          )}
        </div>
      </div>

      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onVerb={onVerb}
          />
        ))}
    </>
  );
}

function ActionBtn({
  label,
  title,
  danger,
  onClick,
}: {
  label: string;
  title: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded text-[11px] transition-colors hover:bg-[var(--navy-light)]"
      style={{ color: danger ? "var(--red)" : "var(--text-secondary)" }}
    >
      {label}
    </button>
  );
}

// ── Node detail panel ────────────────────────────────────────────────────

function NodeDetailPanel({
  node,
  onVerb,
}: {
  node: TreeNode;
  onVerb: (verb: string, node: TreeNode) => void;
}) {
  const budget = node.budgetCap > 0 ? `$${(node.budgetCap / 100).toLocaleString()}/mo` : "—";
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{NODE_ICONS[node.type]}</span>
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {node.name}
          </div>
          <div className="text-[10px] font-mono uppercase" style={{ color: "var(--text-muted)" }}>
            {node.type}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-[12px]">
        <Row label="Budget" value={budget} />
        {node.location && <Row label="Location" value={`📍 ${node.location}`} />}
        {node.tags?.regulatory && (
          <Row
            label="Regulatory"
            value={
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-mono"
                style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "var(--red)" }}
              >
                {node.tags.regulatory}
              </span>
            }
          />
        )}
        <Row label="Children" value={`${node.children.length}`} />
        <Row
          label="Node ID"
          value={
            <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {node.id.substring(0, 24)}…
            </code>
          }
        />
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ActionTile verb="create" node={node} onVerb={onVerb} />
        <ActionTile verb="rename" node={node} onVerb={onVerb} />
        <ActionTile verb="reparent" node={node} onVerb={onVerb} />
        {node.id !== "org_root" && <ActionTile verb="delete" node={node} onVerb={onVerb} />}
      </div>
    </div>
  );
}

function ActionTile({
  verb,
  node,
  onVerb,
}: {
  verb: string;
  node: TreeNode;
  onVerb: (verb: string, node: TreeNode) => void;
}) {
  const config = VERB_LABELS[verb] ?? { label: verb, icon: "?" };
  return (
    <button
      onClick={() => onVerb(verb, node)}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--navy-light)]"
      style={{
        borderColor: config.danger ? "rgba(220,38,38,0.3)" : "var(--border)",
        color: config.danger ? "var(--red)" : "var(--text-primary)",
      }}
    >
      <span className="text-[13px]">{config.icon}</span>
      {config.label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────

function EditModal({
  state,
  onCancel,
  onCreate,
  onRename,
}: {
  state: { verb: string; node: TreeNode };
  onCancel: () => void;
  onCreate: (
    parent: TreeNode,
    name: string,
    type: string,
    location: string,
    budget: number,
  ) => void;
  onRename: (node: TreeNode, newName: string) => void;
}) {
  const [name, setName] = useState(state.node.name);
  const [type, setType] = useState("department");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState(1000);

  const isCreate = state.verb === "create";
  const title = isCreate ? `Add node under "${state.node.name}"` : `Rename "${state.node.name}"`;

  function handleSave() {
    if (!name.trim()) return;
    if (isCreate) {
      onCreate(state.node, name.trim(), type, location.trim(), budget * 100);
    } else {
      onRename(state.node, name.trim());
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-[420px] rounded-lg p-5 shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>

        <div className="space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded border px-2.5 py-1.5 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            />
          </Field>

          {isCreate && (
            <>
              <Field label="Node type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded border px-2.5 py-1.5 text-[13px] outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                >
                  <option value="organization">🏛️ Subsidiary / Organization</option>
                  <option value="hq">🏢 Headquarters</option>
                  <option value="plant">🏭 Plant</option>
                  <option value="department">📁 Department</option>
                  <option value="group">📂 Group</option>
                  <option value="line">─ Production Line</option>
                  <option value="team">👥 Team</option>
                </select>
              </Field>
              <Field label="Location (optional)">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Detroit, MI, USA"
                  className="w-full rounded border px-2.5 py-1.5 text-[13px] outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                />
              </Field>
              <Field label="Monthly budget ($)">
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full rounded border px-2.5 py-1.5 text-[13px] outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                />
              </Field>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md px-4 py-1.5 text-[12px] font-semibold text-white"
            style={{ backgroundColor: "var(--navy)" }}
          >
            {isCreate ? "Create node" : "Save rename"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="mb-1 block text-[11px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Tree utilities ────────────────────────────────────────────────────────

function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

function countByType(node: TreeNode, type: string): number {
  return (
    (node.type === type ? 1 : 0) + node.children.reduce((sum, c) => sum + countByType(c, type), 0)
  );
}
