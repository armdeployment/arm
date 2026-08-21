/**
 * Mock data for the D9 Work Package pages (Catalog / Assignments / Governance).
 *
 * Mirrors the fixture data in packages/trpc/src/catalog-router.ts (same
 * packages, budget caps, and assignment stories). Used by the dashboard pages
 * until they wire to catalog.* tRPC procedures.
 *
 * ALL VALUES ARE SYNTHETIC. No real tenant/agent/cost data.
 */

export interface CatalogPackageRow {
  id: string;
  roleKey: string;
  name: string;
  family: string;
  mode: "copilot" | "automated";
  description: string;
  toolCount: number;
  tools: string[];
}

export interface AssignmentRow {
  id: string;
  assignee: string;
  assigneeType: "user" | "agent" | "org_node";
  roleKey: string;
  packageName: string;
  mode: "copilot" | "automated";
  status: "requested" | "approved" | "active" | "revoked";
  approver: string | null;
  requestedAt: string;
}

export interface PackageBudgetRow {
  roleKey: string;
  name: string;
  monthlyUsdCap: number;
  usedUsd: number;
}

export interface ApprovalInboxRow {
  id: string;
  requester: string;
  packageName: string;
  roleKey: string;
  assigneeType: "user" | "agent" | "org_node";
  requestedAt: string;
}

export interface CostPerWorkProductRow {
  id: string;
  workProduct: string;
  unit: string;
  rawUsd: number;
  reworkRatePct: number;
  effectiveUsd: number;
}

export const catalogPackages: CatalogPackageRow[] = [
  { id: "pkg_quality", roleKey: "quality_engineer", name: "Quality Engineer", family: "Quality", mode: "copilot", toolCount: 2, tools: ["Jira Issue MCP", "PI Historian Connector"], description: "8D/PPAP/SPC copilot — defect triage, control plans, and customer submissions from ticketing + MES feeds." },
  { id: "pkg_plc", roleKey: "plc_programmer", name: "PLC Programmer", family: "Engineering Controls", mode: "copilot", toolCount: 2, tools: ["GitHub Code MCP", "PI Historian Connector"], description: "Ladder/ST codegen with IO-table import, AOI library, and diff/merge tooling for TIA Portal + Studio 5000." },
  { id: "pkg_maint", roleKey: "maintenance_technician", name: "Maintenance Technician", family: "Maintenance", mode: "copilot", toolCount: 2, tools: ["CMMS Connector", "PI Historian Connector"], description: "Fault → fix → CMMS loop: fault-code lookup, spares catalog, SOP checklists — mobile-first." },
  { id: "pkg_office", roleKey: "office_worker_general", name: "Office Worker (General)", family: "General Office", mode: "copilot", toolCount: 1, tools: ["Jira Issue MCP"], description: "The volume default: chat, docs, SharePoint, email triage, meeting notes → actions." },
  { id: "pkg_exec", roleKey: "exec_assistant", name: "Executive Assistant", family: "Executive", mode: "copilot", toolCount: 2, tools: ["Jira Issue MCP", "PI Historian Connector"], description: "KPI briefings, exec digests, approvals-inbox summaries — aggregates-only guardrail enforced." },
  { id: "pkg_material", roleKey: "material_planner", name: "Material Planner", family: "Supply Chain", mode: "automated", toolCount: 2, tools: ["CMMS Connector", "PI Historian Connector"], description: "MRP exception triage, ECN impact alerts, EOL calculators — unattended batch runs." },
];

export const assignments: AssignmentRow[] = [
  { id: "asg_01", assignee: "t.weiss", assigneeType: "user", roleKey: "office_worker_general", packageName: "Office Worker (General)", mode: "copilot", status: "requested", approver: null, requestedAt: "Aug 12, 2026" },
  { id: "asg_02", assignee: "l.wu", assigneeType: "user", roleKey: "quality_engineer", packageName: "Quality Engineer", mode: "copilot", status: "approved", approver: "s.chan", requestedAt: "Aug 11, 2026" },
  { id: "asg_03", assignee: "Assembly Line A", assigneeType: "org_node", roleKey: "plc_programmer", packageName: "PLC Programmer", mode: "copilot", status: "active", approver: "s.chan", requestedAt: "Aug 02, 2026" },
  { id: "asg_04", assignee: "material-plan-batch-01", assigneeType: "agent", roleKey: "material_planner", packageName: "Material Planner", mode: "automated", status: "revoked", approver: "s.chan", requestedAt: "Jul 28, 2026" },
  { id: "asg_05", assignee: "m.patel", assigneeType: "user", roleKey: "maintenance_technician", packageName: "Maintenance Technician", mode: "copilot", status: "active", approver: "s.chan", requestedAt: "Jul 21, 2026" },
  { id: "asg_06", assignee: "a.garcia", assigneeType: "user", roleKey: "exec_assistant", packageName: "Executive Assistant", mode: "copilot", status: "requested", approver: null, requestedAt: "Aug 13, 2026" },
];

/** Per-package budget caps from each version's budget_template.monthly_usd_cap. */
export const packageBudgets: PackageBudgetRow[] = [
  { roleKey: "quality_engineer", name: "Quality Engineer", monthlyUsdCap: 950, usedUsd: 812 },
  { roleKey: "plc_programmer", name: "PLC Programmer", monthlyUsdCap: 700, usedUsd: 523 },
  { roleKey: "maintenance_technician", name: "Maintenance Technician", monthlyUsdCap: 420, usedUsd: 306 },
  { roleKey: "office_worker_general", name: "Office Worker (General)", monthlyUsdCap: 300, usedUsd: 244 },
  { roleKey: "exec_assistant", name: "Executive Assistant", monthlyUsdCap: 400, usedUsd: 181 },
  { roleKey: "material_planner", name: "Material Planner", monthlyUsdCap: 600, usedUsd: 612 },
];

export const approvalInbox: ApprovalInboxRow[] = [
  { id: "inbox_01", requester: "t.weiss", packageName: "Office Worker (General)", roleKey: "office_worker_general", assigneeType: "user", requestedAt: "Aug 12, 09:41" },
  { id: "inbox_02", requester: "a.garcia", packageName: "Executive Assistant", roleKey: "exec_assistant", assigneeType: "user", requestedAt: "Aug 13, 08:05" },
  { id: "inbox_03", requester: "s.ramos", packageName: "Material Planner", roleKey: "material_planner", assigneeType: "org_node", requestedAt: "Aug 13, 07:52" },
];

/**
 * Cost per work product with rework-rate counterweight (D9 §moat metric).
 * effective = raw × (1 + reworkRate) — re-opened work products re-burn tokens.
 */
export const costPerWorkProduct: CostPerWorkProductRow[] = [
  { id: "cpwp_8d", workProduct: "8D Report", unit: "$ / 8D", rawUsd: 182, reworkRatePct: 6.2, effectiveUsd: 214 },
  { id: "cpwp_ppap", workProduct: "PPAP Submission", unit: "$ / PPAP", rawUsd: 298, reworkRatePct: 4.1, effectiveUsd: 312 },
  { id: "cpwp_plc", workProduct: "PLC Routine", unit: "$ / routine", rawUsd: 16, reworkRatePct: 9.8, effectiveUsd: 18 },
];
