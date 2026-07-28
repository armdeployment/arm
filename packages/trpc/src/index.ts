/**
 * ARM tRPC package (spec §9 1.0, §6.1 inheritance chain).
 *
 * The dashboard is a HIERARCHICAL DRILL-DOWN explorer, not a flat view.
 * Data is organized by the org tree (§6.1):
 *   Org → Department → Group → Team → (Workstream →) Agent
 *
 * Every query accepts an optional `scope` param ({ type, id }). When omitted,
 * it defaults to the org root (CEO view). When set to a department, it returns
 * that department's rolled-up data (department-head view). And so on down.
 *
 * FIXTURE DATA: routers return inline fixture data for the 1.0 scaffold.
 * TODO(1.1): replace with real Postgres/ClickHouse queries.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ARMClaims } from "@arm/auth";
import { initTelemetry, getHealth, type ServiceHealth } from "@arm/config";

// ── Context ────────────────────────────────────────────────────────────────

export interface ARMContext {
  claims: ARMClaims | null;
  tenantId: string | null;
}

export function createContext(opts: { claims?: ARMClaims | null }): ARMContext {
  const claims = opts.claims ?? null;
  return { claims, tenantId: claims?.tenant_id ?? null };
}

// ── tRPC setup ─────────────────────────────────────────────────────────────

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
});

const publicProcedure = t.procedure;

// ── Scope input type ───────────────────────────────────────────────────────

const scopeInput = z
  .object({
    type: z.enum(["org", "department", "group", "team"]),
    id: z.string(),
  })
  .nullable()
  .default(null);

type ScopeRef = { type: "org" | "department" | "group" | "team"; id: string } | null;

// ── Fixture: Org Tree (spec §4.1, §6.1) ────────────────────────────────────

interface ScopeNode {
  id: string;
  name: string;
  type: "org" | "department" | "group" | "team";
  parentId: string | null;
  budgetCap: number;
}

interface AgentFixture {
  id: string;
  name: string;
  tier: "critical" | "standard" | "background";
  stakeholder: string;
  scopeType: "team" | "group" | "department" | "org";
  scopeId: string;
  scopeLabel: string;
  monthlySpend: number;
  status: string;
  taskType: string;
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
}

const SCOPES: ScopeNode[] = [
  { id: "org_acme", name: "Acme Manufacturing", type: "org", parentId: null, budgetCap: 20000 },
  // Engineering
  { id: "dept_eng", name: "Engineering", type: "department", parentId: "org_acme", budgetCap: 2500 },
  { id: "grp_prod_dsgn", name: "Product Design", type: "group", parentId: "dept_eng", budgetCap: 1500 },
  { id: "team_cad", name: "CAD Design", type: "team", parentId: "grp_prod_dsgn", budgetCap: 700 },
  { id: "team_sim", name: "Simulation", type: "team", parentId: "grp_prod_dsgn", budgetCap: 600 },
  { id: "grp_tooling", name: "Tooling", type: "group", parentId: "dept_eng", budgetCap: 800 },
  { id: "team_tool", name: "Tool Design", type: "team", parentId: "grp_tooling", budgetCap: 600 },
  // Manufacturing
  { id: "dept_mfg", name: "Manufacturing", type: "department", parentId: "org_acme", budgetCap: 4000 },
  { id: "grp_production", name: "Production", type: "group", parentId: "dept_mfg", budgetCap: 3000 },
  { id: "team_line_a", name: "Assembly Line A", type: "team", parentId: "grp_production", budgetCap: 1500 },
  { id: "team_line_b", name: "Assembly Line B", type: "team", parentId: "grp_production", budgetCap: 1200 },
  { id: "grp_maint", name: "Maintenance", type: "group", parentId: "dept_mfg", budgetCap: 1000 },
  { id: "team_pm", name: "Predictive Maint", type: "team", parentId: "grp_maint", budgetCap: 600 },
  // Quality Assurance
  { id: "dept_qa", name: "Quality Assurance", type: "department", parentId: "org_acme", budgetCap: 2500 },
  { id: "grp_inspection", name: "Inspection", type: "group", parentId: "dept_qa", budgetCap: 1800 },
  { id: "team_incoming", name: "Incoming QC", type: "team", parentId: "grp_inspection", budgetCap: 700 },
  { id: "team_final", name: "Final QC", type: "team", parentId: "grp_inspection", budgetCap: 1000 },
  { id: "grp_compliance", name: "Compliance", type: "group", parentId: "dept_qa", budgetCap: 600 },
  { id: "team_iso", name: "ISO Audit", type: "team", parentId: "grp_compliance", budgetCap: 400 },
  // Supply Chain
  { id: "dept_sc", name: "Supply Chain", type: "department", parentId: "org_acme", budgetCap: 2000 },
  { id: "grp_procurement", name: "Procurement", type: "group", parentId: "dept_sc", budgetCap: 1200 },
  { id: "team_raw", name: "Raw Materials", type: "team", parentId: "grp_procurement", budgetCap: 600 },
  { id: "team_components", name: "Components", type: "team", parentId: "grp_procurement", budgetCap: 600 },
  { id: "grp_logistics", name: "Logistics", type: "group", parentId: "dept_sc", budgetCap: 700 },
  { id: "team_warehouse", name: "Warehouse", type: "team", parentId: "grp_logistics", budgetCap: 500 },
  // R&D
  { id: "dept_rd", name: "Research & Development", type: "department", parentId: "org_acme", budgetCap: 2500 },
  { id: "grp_materials", name: "Materials Research", type: "group", parentId: "dept_rd", budgetCap: 1500 },
  { id: "team_metallurgy", name: "Metallurgy", type: "team", parentId: "grp_materials", budgetCap: 700 },
  { id: "team_polymers", name: "Polymers", type: "team", parentId: "grp_materials", budgetCap: 600 },
  { id: "grp_process", name: "Process Innovation", type: "group", parentId: "dept_rd", budgetCap: 800 },
  { id: "team_new_proc", name: "New Process", type: "team", parentId: "grp_process", budgetCap: 600 },
  // Sales & Marketing
  { id: "dept_sales", name: "Sales & Marketing", type: "department", parentId: "org_acme", budgetCap: 1800 },
  { id: "grp_sales", name: "Sales", type: "group", parentId: "dept_sales", budgetCap: 1000 },
  { id: "team_domestic", name: "Domestic", type: "team", parentId: "grp_sales", budgetCap: 500 },
  { id: "team_export", name: "Export", type: "team", parentId: "grp_sales", budgetCap: 500 },
  { id: "grp_mktg", name: "Marketing", type: "group", parentId: "dept_sales", budgetCap: 600 },
  { id: "team_digital", name: "Digital", type: "team", parentId: "grp_mktg", budgetCap: 400 },
  // Finance
  { id: "dept_fin", name: "Finance", type: "department", parentId: "org_acme", budgetCap: 2000 },
  { id: "grp_accounting", name: "Accounting", type: "group", parentId: "dept_fin", budgetCap: 1200 },
  { id: "team_ap_ar", name: "AP/AR", type: "team", parentId: "grp_accounting", budgetCap: 600 },
  { id: "team_cost", name: "Cost Accounting", type: "team", parentId: "grp_accounting", budgetCap: 600 },
  { id: "grp_treasury", name: "Treasury", type: "group", parentId: "dept_fin", budgetCap: 600 },
  { id: "team_cash", name: "Cash Mgmt", type: "team", parentId: "grp_treasury", budgetCap: 400 },
  // HR
  { id: "dept_hr", name: "Human Resources", type: "department", parentId: "org_acme", budgetCap: 1500 },
  { id: "grp_talent", name: "Talent", type: "group", parentId: "dept_hr", budgetCap: 800 },
  { id: "team_recruit", name: "Recruiting", type: "team", parentId: "grp_talent", budgetCap: 400 },
  { id: "team_onboard", name: "Onboarding", type: "team", parentId: "grp_talent", budgetCap: 300 },
  { id: "grp_people", name: "People Ops", type: "group", parentId: "dept_hr", budgetCap: 600 },
  { id: "team_payroll", name: "Payroll", type: "team", parentId: "grp_people", budgetCap: 400 },
  // IT & Digital
  { id: "dept_it", name: "IT & Digital", type: "department", parentId: "org_acme", budgetCap: 2200 },
  { id: "grp_infra", name: "Infrastructure", type: "group", parentId: "dept_it", budgetCap: 1400 },
  { id: "team_network", name: "Network", type: "team", parentId: "grp_infra", budgetCap: 700 },
  { id: "team_cloud", name: "Cloud", type: "team", parentId: "grp_infra", budgetCap: 500 },
  { id: "grp_data_plat", name: "Data Platform", type: "group", parentId: "dept_it", budgetCap: 600 },
  { id: "team_analytics", name: "Analytics", type: "team", parentId: "grp_data_plat", budgetCap: 500 },
  // Customer Service
  { id: "dept_cs", name: "Customer Service", type: "department", parentId: "org_acme", budgetCap: 1500 },
  { id: "grp_support", name: "Support", type: "group", parentId: "dept_cs", budgetCap: 900 },
  { id: "team_tech_sup", name: "Technical", type: "team", parentId: "grp_support", budgetCap: 500 },
  { id: "team_field", name: "Field Service", type: "team", parentId: "grp_support", budgetCap: 400 },
  { id: "grp_training", name: "Training", type: "group", parentId: "dept_cs", budgetCap: 400 },
  { id: "team_cust_trn", name: "Customer Training", type: "team", parentId: "grp_training", budgetCap: 300 },
];

const AGENTS: AgentFixture[] = [
  // Engineering: CAD Design
  { id: "agt_01", name: "cad-assistant", tier: "standard", stakeholder: "j.chen", scopeType: "team", scopeId: "team_cad", scopeLabel: "CAD Design", monthlySpend: 420, status: "active", taskType: "CAD model generation & validation", classificationClearance: "confidential" },
  { id: "agt_02", name: "drawing-checker", tier: "standard", stakeholder: "j.chen", scopeType: "team", scopeId: "team_cad", scopeLabel: "CAD Design", monthlySpend: 280, status: "active", taskType: "Engineering drawing compliance check", classificationClearance: "confidential" },
  // Engineering: Simulation
  { id: "agt_03", name: "fea-solver", tier: "standard", stakeholder: "j.chen", scopeType: "team", scopeId: "team_sim", scopeLabel: "Simulation", monthlySpend: 350, status: "active", taskType: "FEA stress analysis", classificationClearance: "confidential" },
  { id: "agt_04", name: "cfd-analyzer", tier: "background", stakeholder: "j.chen", scopeType: "team", scopeId: "team_sim", scopeLabel: "Simulation", monthlySpend: 180, status: "active", taskType: "CFD thermal simulation", classificationClearance: "confidential" },
  // Engineering: Tool Design
  { id: "agt_05", name: "toolpath-optimizer", tier: "standard", stakeholder: "j.chen", scopeType: "team", scopeId: "team_tool", scopeLabel: "Tool Design", monthlySpend: 310, status: "active", taskType: "CNC toolpath optimization", classificationClearance: "confidential" },
  { id: "agt_06", name: "die-designer", tier: "standard", stakeholder: "j.chen", scopeType: "team", scopeId: "team_tool", scopeLabel: "Tool Design", monthlySpend: 260, status: "active", taskType: "Die & mold CAD design", classificationClearance: "confidential" },
  // Manufacturing: Assembly Line A
  { id: "agt_07", name: "line-monitor-a", tier: "critical", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_line_a", scopeLabel: "Assembly Line A", monthlySpend: 890, status: "active", taskType: "Real-time line throughput monitoring", classificationClearance: "internal" },
  { id: "agt_08", name: "defect-detector-a", tier: "critical", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_line_a", scopeLabel: "Assembly Line A", monthlySpend: 720, status: "active", taskType: "Vision-based defect detection", classificationClearance: "confidential" },
  // Manufacturing: Assembly Line B
  { id: "agt_09", name: "line-monitor-b", tier: "standard", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_line_b", scopeLabel: "Assembly Line B", monthlySpend: 560, status: "active", taskType: "Production speed optimization", classificationClearance: "internal" },
  { id: "agt_10", name: "yield-optimizer", tier: "standard", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_line_b", scopeLabel: "Assembly Line B", monthlySpend: 340, status: "active", taskType: "First-pass yield improvement", classificationClearance: "confidential" },
  // Manufacturing: Predictive Maintenance
  { id: "agt_11", name: "vibration-analyzer", tier: "standard", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_pm", scopeLabel: "Predictive Maint", monthlySpend: 380, status: "active", taskType: "Vibration signature analysis", classificationClearance: "internal" },
  { id: "agt_12", name: "pm-scheduler", tier: "background", stakeholder: "s.ramos", scopeType: "team", scopeId: "team_pm", scopeLabel: "Predictive Maint", monthlySpend: 150, status: "active", taskType: "Preventive maintenance scheduling", classificationClearance: "internal" },
  // QA: Incoming QC
  { id: "agt_13", name: "material-inspector", tier: "standard", stakeholder: "l.wu", scopeType: "team", scopeId: "team_incoming", scopeLabel: "Incoming QC", monthlySpend: 290, status: "active", taskType: "Raw material batch inspection", classificationClearance: "confidential" },
  { id: "agt_14", name: "spec-checker", tier: "standard", stakeholder: "l.wu", scopeType: "team", scopeId: "team_incoming", scopeLabel: "Incoming QC", monthlySpend: 240, status: "active", taskType: "Specification compliance check", classificationClearance: "confidential" },
  // QA: Final QC
  { id: "agt_15", name: "visual-inspector", tier: "critical", stakeholder: "l.wu", scopeType: "team", scopeId: "team_final", scopeLabel: "Final QC", monthlySpend: 680, status: "active", taskType: "Final visual inspection", classificationClearance: "confidential" },
  { id: "agt_16", name: "dimension-checker", tier: "standard", stakeholder: "l.wu", scopeType: "team", scopeId: "team_final", scopeLabel: "Final QC", monthlySpend: 320, status: "active", taskType: "Dimensional tolerance verification", classificationClearance: "confidential" },
  // QA: ISO Audit
  { id: "agt_17", name: "audit-checker", tier: "standard", stakeholder: "l.wu", scopeType: "team", scopeId: "team_iso", scopeLabel: "ISO Audit", monthlySpend: 270, status: "active", taskType: "ISO 9001 compliance checklist", classificationClearance: "confidential" },
  { id: "agt_18", name: "cert-renewal-bot", tier: "background", stakeholder: "l.wu", scopeType: "team", scopeId: "team_iso", scopeLabel: "ISO Audit", monthlySpend: 130, status: "active", taskType: "Certification renewal tracking", classificationClearance: "internal" },
  // Supply Chain: Raw Materials
  { id: "agt_19", name: "price-tracker", tier: "standard", stakeholder: "m.patel", scopeType: "team", scopeId: "team_raw", scopeLabel: "Raw Materials", monthlySpend: 250, status: "active", taskType: "Commodity price monitoring", classificationClearance: "internal" },
  { id: "agt_20", name: "vendor-evaluator", tier: "background", stakeholder: "m.patel", scopeType: "team", scopeId: "team_raw", scopeLabel: "Raw Materials", monthlySpend: 140, status: "active", taskType: "Supplier performance scoring", classificationClearance: "internal" },
  // Supply Chain: Components
  { id: "agt_21", name: "bom-optimizer", tier: "standard", stakeholder: "m.patel", scopeType: "team", scopeId: "team_components", scopeLabel: "Components", monthlySpend: 360, status: "active", taskType: "BOM cost optimization", classificationClearance: "confidential" },
  { id: "agt_22", name: "lead-time-tracker", tier: "background", stakeholder: "m.patel", scopeType: "team", scopeId: "team_components", scopeLabel: "Components", monthlySpend: 120, status: "active", taskType: "Supplier lead time tracking", classificationClearance: "internal" },
  // Supply Chain: Warehouse
  { id: "agt_23", name: "inventory-optimizer", tier: "standard", stakeholder: "m.patel", scopeType: "team", scopeId: "team_warehouse", scopeLabel: "Warehouse", monthlySpend: 330, status: "active", taskType: "Inventory level optimization", classificationClearance: "internal" },
  { id: "agt_24", name: "pick-route-planner", tier: "background", stakeholder: "m.patel", scopeType: "team", scopeId: "team_warehouse", scopeLabel: "Warehouse", monthlySpend: 110, status: "active", taskType: "Pick-and-pack route planning", classificationClearance: "internal" },
  // R&D: Metallurgy
  { id: "agt_25", name: "alloy-analyzer", tier: "standard", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_metallurgy", scopeLabel: "Metallurgy", monthlySpend: 410, status: "active", taskType: "Alloy composition analysis", classificationClearance: "restricted" },
  { id: "agt_26", name: "stress-tester", tier: "standard", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_metallurgy", scopeLabel: "Metallurgy", monthlySpend: 340, status: "active", taskType: "Tensile & fatigue testing", classificationClearance: "restricted" },
  // R&D: Polymers
  { id: "agt_27", name: "compound-formulator", tier: "standard", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_polymers", scopeLabel: "Polymers", monthlySpend: 380, status: "active", taskType: "Polymer compound formulation", classificationClearance: "restricted" },
  { id: "agt_28", name: "durability-tester", tier: "background", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_polymers", scopeLabel: "Polymers", monthlySpend: 190, status: "active", taskType: "Accelerated aging tests", classificationClearance: "restricted" },
  // R&D: New Process
  { id: "agt_29", name: "process-simulator", tier: "standard", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_new_proc", scopeLabel: "New Process", monthlySpend: 460, status: "active", taskType: "Manufacturing process simulation", classificationClearance: "restricted" },
  { id: "agt_30", name: "yield-predictor", tier: "background", stakeholder: "k.yamamoto", scopeType: "team", scopeId: "team_new_proc", scopeLabel: "New Process", monthlySpend: 210, status: "active", taskType: "Production yield prediction", classificationClearance: "restricted" },
  // Sales: Domestic
  { id: "agt_31", name: "quote-generator", tier: "standard", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_domestic", scopeLabel: "Domestic", monthlySpend: 280, status: "active", taskType: "Customer quote generation", classificationClearance: "internal" },
  { id: "agt_32", name: "crm-updater", tier: "background", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_domestic", scopeLabel: "Domestic", monthlySpend: 90, status: "active", taskType: "CRM data enrichment", classificationClearance: "internal" },
  // Sales: Export
  { id: "agt_33", name: "trade-compliance", tier: "standard", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_export", scopeLabel: "Export", monthlySpend: 310, status: "active", taskType: "Export regulation compliance", classificationClearance: "confidential" },
  { id: "agt_34", name: "forex-hedger", tier: "background", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_export", scopeLabel: "Export", monthlySpend: 160, status: "active", taskType: "FX risk assessment", classificationClearance: "confidential" },
  // Marketing: Digital
  { id: "agt_35", name: "content-gen", tier: "standard", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_digital", scopeLabel: "Digital", monthlySpend: 220, status: "active", taskType: "Technical content generation", classificationClearance: "internal" },
  { id: "agt_36", name: "seo-optimizer", tier: "background", stakeholder: "a.garcia", scopeType: "team", scopeId: "team_digital", scopeLabel: "Digital", monthlySpend: 110, status: "active", taskType: "SEO meta optimization", classificationClearance: "internal" },
  // Finance: AP/AR
  { id: "agt_37", name: "invoice-processor", tier: "standard", stakeholder: "r.smith", scopeType: "team", scopeId: "team_ap_ar", scopeLabel: "AP/AR", monthlySpend: 260, status: "active", taskType: "Invoice processing & matching", classificationClearance: "confidential" },
  { id: "agt_38", name: "recon-bot", tier: "standard", stakeholder: "r.smith", scopeType: "team", scopeId: "team_ap_ar", scopeLabel: "AP/AR", monthlySpend: 180, status: "active", taskType: "Bank reconciliation", classificationClearance: "confidential" },
  // Finance: Cost Accounting
  { id: "agt_39", name: "cost-analyzer", tier: "standard", stakeholder: "r.smith", scopeType: "team", scopeId: "team_cost", scopeLabel: "Cost Accounting", monthlySpend: 320, status: "active", taskType: "Manufacturing cost analysis", classificationClearance: "confidential" },
  { id: "agt_40", name: "variance-reporter", tier: "background", stakeholder: "r.smith", scopeType: "team", scopeId: "team_cost", scopeLabel: "Cost Accounting", monthlySpend: 140, status: "active", taskType: "Budget vs actual variance", classificationClearance: "internal" },
  // Finance: Treasury
  { id: "agt_41", name: "cash-forecaster", tier: "standard", stakeholder: "r.smith", scopeType: "team", scopeId: "team_cash", scopeLabel: "Cash Mgmt", monthlySpend: 290, status: "active", taskType: "Cash flow forecasting", classificationClearance: "confidential" },
  { id: "agt_42", name: "credit-monitor", tier: "background", stakeholder: "r.smith", scopeType: "team", scopeId: "team_cash", scopeLabel: "Cash Mgmt", monthlySpend: 120, status: "active", taskType: "Customer credit monitoring", classificationClearance: "confidential" },
  // HR: Recruiting
  { id: "agt_43", name: "resume-screener", tier: "standard", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_recruit", scopeLabel: "Recruiting", monthlySpend: 190, status: "active", taskType: "Resume screening & ranking", classificationClearance: "confidential" },
  { id: "agt_44", name: "interview-scheduler", tier: "background", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_recruit", scopeLabel: "Recruiting", monthlySpend: 80, status: "active", taskType: "Interview scheduling automation", classificationClearance: "internal" },
  // HR: Onboarding
  { id: "agt_45", name: "onboarding-assist", tier: "standard", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_onboard", scopeLabel: "Onboarding", monthlySpend: 150, status: "active", taskType: "New hire onboarding checklist", classificationClearance: "confidential" },
  { id: "agt_46", name: "doc-collector", tier: "background", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_onboard", scopeLabel: "Onboarding", monthlySpend: 70, status: "active", taskType: "Onboarding document collection", classificationClearance: "confidential" },
  // HR: Payroll
  { id: "agt_47", name: "payroll-validator", tier: "standard", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_payroll", scopeLabel: "Payroll", monthlySpend: 230, status: "active", taskType: "Payroll calculation validation", classificationClearance: "confidential" },
  { id: "agt_48", name: "tax-filer", tier: "background", stakeholder: "t.johnson", scopeType: "team", scopeId: "team_payroll", scopeLabel: "Payroll", monthlySpend: 100, status: "active", taskType: "Payroll tax filing", classificationClearance: "confidential" },
  // IT: Network
  { id: "agt_49", name: "network-monitor", tier: "standard", stakeholder: "d.lee", scopeType: "team", scopeId: "team_network", scopeLabel: "Network", monthlySpend: 340, status: "active", taskType: "Network performance monitoring", classificationClearance: "internal" },
  { id: "agt_50", name: "security-scanner", tier: "critical", stakeholder: "d.lee", scopeType: "team", scopeId: "team_network", scopeLabel: "Network", monthlySpend: 520, status: "active", taskType: "Vulnerability scanning", classificationClearance: "confidential" },
  // IT: Cloud
  { id: "agt_51", name: "cloud-cost-opt", tier: "standard", stakeholder: "d.lee", scopeType: "team", scopeId: "team_cloud", scopeLabel: "Cloud", monthlySpend: 310, status: "active", taskType: "Cloud resource cost optimization", classificationClearance: "internal" },
  { id: "agt_52", name: "backup-checker", tier: "background", stakeholder: "d.lee", scopeType: "team", scopeId: "team_cloud", scopeLabel: "Cloud", monthlySpend: 90, status: "active", taskType: "Backup verification & reporting", classificationClearance: "internal" },
  // IT: Analytics
  { id: "agt_53", name: "etl-watcher", tier: "standard", stakeholder: "d.lee", scopeType: "team", scopeId: "team_analytics", scopeLabel: "Analytics", monthlySpend: 270, status: "active", taskType: "ETL pipeline monitoring", classificationClearance: "internal" },
  { id: "agt_54", name: "data-pipe-monitor", tier: "background", stakeholder: "d.lee", scopeType: "team", scopeId: "team_analytics", scopeLabel: "Analytics", monthlySpend: 180, status: "disabled", taskType: "Data pipeline health checks", classificationClearance: "internal" },
  // Customer Service: Technical
  { id: "agt_55", name: "warranty-processor", tier: "standard", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_tech_sup", scopeLabel: "Technical", monthlySpend: 240, status: "active", taskType: "Warranty claim processing", classificationClearance: "internal" },
  { id: "agt_56", name: "faq-bot", tier: "standard", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_tech_sup", scopeLabel: "Technical", monthlySpend: 190, status: "active", taskType: "Customer FAQ automation", classificationClearance: "internal" },
  // Customer Service: Field Service
  { id: "agt_57", name: "dispatch-optimizer", tier: "standard", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_field", scopeLabel: "Field Service", monthlySpend: 280, status: "active", taskType: "Field service dispatch routing", classificationClearance: "internal" },
  { id: "agt_58", name: "parts-tracker", tier: "background", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_field", scopeLabel: "Field Service", monthlySpend: 130, status: "active", taskType: "Spare parts inventory tracking", classificationClearance: "internal" },
  // Customer Service: Customer Training
  { id: "agt_59", name: "manual-generator", tier: "background", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_cust_trn", scopeLabel: "Customer Training", monthlySpend: 110, status: "active", taskType: "User manual generation", classificationClearance: "internal" },
  { id: "agt_60", name: "video-script-writer", tier: "background", stakeholder: "c.nunez", scopeType: "team", scopeId: "team_cust_trn", scopeLabel: "Customer Training", monthlySpend: 140, status: "active", taskType: "Training video scriptwriting", classificationClearance: "internal" },
];




// ── Routers ────────────────────────────────────────────────────────────────

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

// ── Fixture: charts + access ───────────────────────────────────────────────

const FIXTURE_SPEND_TREND = [
  { date: "Jul 01", claude: 420, gpt: 310, glm: 80 },
  { date: "Jul 05", claude: 460, gpt: 340, glm: 95 },
  { date: "Jul 10", claude: 510, gpt: 380, glm: 120 },
  { date: "Jul 15", claude: 480, gpt: 350, glm: 160 },
  { date: "Jul 20", claude: 440, gpt: 320, glm: 210 },
  { date: "Jul 25", claude: 410, gpt: 290, glm: 260 },
];

const FIXTURE_MODEL_SPEND = [
  { model: "Claude Sonnet 4.5", provider: "Anthropic", spend: 2720, kind: "closed" as const },
  { model: "GPT-4o", provider: "OpenAI", spend: 1990, kind: "closed" as const },
  { model: "GLM-5.2", provider: "Self-hosted", spend: 925, kind: "self_hosted" as const },
  { model: "DeepSeek V3", provider: "Self-hosted", spend: 340, kind: "self_hosted" as const },
];

const FIXTURE_ACCESS_REQUESTS = [
  { id: "req_01", agentId: "cad-assistant", resourceId: "s3://engineering/cad-files/", status: "pending", action: "read", reason: "Review new product CAD models (confidential)" },
  { id: "req_02", agentId: "cost-analyzer", resourceId: "db://erp/manufacturing_costs", status: "pending", action: "query", reason: "Monthly cost variance analysis" },
];

const telemetryState = initTelemetry("control-plane");


// ── Tree helpers ───────────────────────────────────────────────────────────

function resolveScope(ref: ScopeRef): ScopeNode {
  if (!ref) return SCOPES.find((s) => s.type === "org")!;
  return SCOPES.find((s) => s.id === ref.id && s.type === ref.type) ??
    (() => { throw new TRPCError({ code: "NOT_FOUND", message: `Scope ${ref.type}:${ref.id} not found` }); })();
}

function descendantScopeIds(scope: ScopeNode): Set<string> {
  const ids = new Set<string>([scope.id]);
  let added = true;
  while (added) {
    added = false;
    for (const s of SCOPES) {
      if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) {
        ids.add(s.id);
        added = true;
      }
    }
  }
  return ids;
}

function scopePath(scope: ScopeNode): ScopeNode[] {
  const path: ScopeNode[] = [scope];
  let current = scope;
  while (current.parentId) {
    const parent = SCOPES.find((s) => s.id === current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

function childScopes(scope: ScopeNode): ScopeNode[] {
  return SCOPES.filter((s) => s.parentId === scope.id);
}

function agentsInScope(scope: ScopeNode): AgentFixture[] {
  const ids = descendantScopeIds(scope);
  return AGENTS.filter((a) => ids.has(a.scopeId));
}

function spendInScope(scope: ScopeNode): number {
  return agentsInScope(scope).reduce((sum, a) => sum + a.monthlySpend, 0);
}


const orgTreeRouter = t.router({
  /** Returns breadcrumb path from org root to the given scope. */
  path: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      return {
        tenantId: opts.ctx.tenantId!,
        path: scopePath(scope).map((s) => ({ id: s.id, name: s.name, type: s.type })),
      };
    }),

  /** Returns immediate child scopes of the given scope (or org root). */
  children: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const children = childScopes(scope).map((child) => {
        const agents = agentsInScope(child);
        const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
        return {
          id: child.id,
          name: child.name,
          type: child.type,
          monthlySpend: spend,
          agentCount: agents.length,
          budgetCap: child.budgetCap,
          budgetUtilPct: Math.round((spend / child.budgetCap) * 100),
          criticalCount: agents.filter((a) => a.tier === "critical").length,
        };
      });
      return { tenantId: opts.ctx.tenantId!, scope: { id: scope.id, name: scope.name, type: scope.type }, children };
    }),

  /** Returns the FULL org tree with spend/agent rollups at every level.
   *  Used for treemap and tree-view visualizations — no drill-down needed. */
  fullTree: tenantProcedure.query(async (opts) => {
    function buildNode(scope: ScopeNode): TreeNode {
      const kids = childScopes(scope);
      const agents = agentsInScope(scope);
      const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
      const node: TreeNode = {
        id: scope.id,
        name: scope.name,
        type: scope.type,
        monthlySpend: spend,
        agentCount: agents.length,
        budgetCap: scope.budgetCap,
        budgetUtilPct: Math.round((spend / scope.budgetCap) * 100),
        criticalCount: agents.filter((a) => a.tier === "critical").length,
        children: kids.map(buildNode),
      };
      return node;
    }

    const root = SCOPES.find((s) => s.type === "org")!;
    return { tenantId: opts.ctx.tenantId!, tree: buildNode(root) };
  }),
  /** Work-type classification per scope — what agents DO, not just what they cost. */
  workTypes: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const agents = agentsInScope(scope);
      // Group by first 2 words of taskType
      const byCategory = new Map<string, { count: number; spend: number }>();
      for (const a of agents) {
        const cat = a.taskType.split(" ").slice(0, 3).join(" ").replace(/[&,].*$/, "").trim();
        const entry = byCategory.get(cat) ?? { count: 0, spend: 0 };
        entry.count++;
        entry.spend += a.monthlySpend;
        byCategory.set(cat, entry);
      }
      const workTypes = [...byCategory.entries()]
        .map(([category, stats]) => ({ category, agentCount: stats.count, spend: stats.spend }))
        .sort((a, b) => b.spend - a.spend);
      const classes: Record<string, number> = { public: 0, internal: 0, confidential: 0, restricted: 0 };
      for (const a of agents) { const k = a.classificationClearance; classes[k] = (classes[k] ?? 0) + 1; }
      const classificationBreakdown = Object.entries(classes)
        .filter(([, c]) => c > 0)
        .map(([clearance, count]) => ({ clearance, count }));
      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        totalSpend: agents.reduce((s, a) => s + a.monthlySpend, 0),
        agentCount: agents.length,
        workTypes,
        classificationBreakdown,
      };
    }),
});

const spendRouter = t.router({
  summary: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const agents = agentsInScope(scope);
      const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
      const tiers = { critical: 0, standard: 0, background: 0 };
      for (const a of agents) tiers[a.tier]++;

      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        totalMonthlySpend: spend,
        agentCount: agents.length,
        budgetCap: scope.budgetCap,
        budgetUtilPct: Math.round((spend / scope.budgetCap) * 100),
        proxiedTrafficPct: 84,
        pendingApprovals: FIXTURE_ACCESS_REQUESTS.length,
        tierBreakdown: [
          { tier: "critical", count: tiers.critical, color: "#e11d48" },
          { tier: "standard", count: tiers.standard, color: "#2563eb" },
          { tier: "background", count: tiers.background, color: "#64748b" },
        ],
      };
    }),

  byModel: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      // TODO(1.1): scope-filter from ClickHouse
      return { tenantId: opts.ctx.tenantId!, models: FIXTURE_MODEL_SPEND };
    }),

  trend: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      // TODO(1.1): scope-filter from ClickHouse
      return { tenantId: opts.ctx.tenantId!, points: FIXTURE_SPEND_TREND };
    }),

  /** Savings estimator — how much if we switch scopes to open models (spec §8.3). */
  savingsEstimate: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const agents = agentsInScope(scope);
      const totalSpend = agents.reduce((s, a) => s + a.monthlySpend, 0);
      // Estimate: 40% saving by switching to open models
      const potentialSavings = Math.round(totalSpend * 0.40);
      const newTotal = totalSpend - potentialSavings;
      const switchedAgents = agents.length;
      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        currentMonthlySpend: totalSpend,
        openModelMonthlyEstimate: newTotal,
        potentialSavings,
        savingsPct: 40,
        impactedAgents: switchedAgents,
        recommendation: potentialSavings > 0 ? `Switch ${switchedAgents} agents to open models to save $${potentialSavings.toLocaleString()}/mo` : "No savings available",
      };
    }),

  /** Reconciliation — provider bill vs proxy metering (spec §7.3). */
  reconciliation: tenantProcedure.query(async (opts) => {
    // TODO(1.1): call billing.anthropicConnector.fetchUsage + billing.reconcile
    // with real proxy totals from ClickHouse.
    return {
      tenantId: opts.ctx.tenantId!,
      providerTotalUsd: 16170,
      proxyTotalUsd: 15840,
      driftPct: 2.0,
      status: "ok" as const,
      message: "Reconciled within tolerance (2.0% drift).",
      byModel: [
        { model: "Claude Sonnet 4.5", providerUsd: 9200, proxyUsd: 9016, driftPct: 2.0 },
        { model: "GPT-4o", providerUsd: 4700, proxyUsd: 4610, driftPct: 1.9 },
        { model: "GLM-5.2", providerUsd: 1270, proxyUsd: 1250, driftPct: 1.6 },
        { model: "DeepSeek V3", providerUsd: 1000, proxyUsd: 964, driftPct: 3.6 },
      ],
    };
  }),
});

const agentsRouter = t.router({
  list: tenantProcedure
    .input(z.object({ scope: scopeInput, status: z.enum(["active", "disabled", "all"]).default("all") }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      let agents = agentsInScope(scope);
      if (opts.input.status !== "all") {
        agents = agents.filter((a) => a.status === opts.input.status);
      }
      agents = [...agents].sort((a, b) => b.monthlySpend - a.monthlySpend);
      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          tier: a.tier,
          stakeholder: a.stakeholder,
          scope: a.scopeLabel,
          monthlySpend: a.monthlySpend,
          status: a.status,
          taskType: a.taskType,
          classificationClearance: a.classificationClearance,
        })),
      };
    }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scopeType: z.enum(["org", "department", "group", "team", "workstream"]),
        scopeId: z.string().uuid(),
        stakeholderUserId: z.string().uuid(),
        type: z.string(),
        priorityTier: z.enum(["critical", "standard", "background"]).default("standard"),
      }),
    )
    .mutation(async (opts) => {
      return { id: "agt_new", tenantId: opts.ctx.tenantId!, ...opts.input };
    }),
});

const accessRouter = t.router({
  pendingApprovals: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      return { tenantId: opts.ctx.tenantId!, requests: FIXTURE_ACCESS_REQUESTS };
    }),

  requestAccess: tenantProcedure
    .input(z.object({ resourceId: z.string(), actions: z.array(z.string()), reason: z.string().optional() }))
    .mutation(async (opts) => {
      return { id: "req_new", tenantId: opts.ctx.tenantId!, status: "pending" };
    }),
});

const healthRouter = t.router({
  check: publicProcedure.query((): ServiceHealth => getHealth("control-plane", telemetryState.active)),
});

// ── Root router ────────────────────────────────────────────────────────────

/** Policy router — classification-gated model routing (spec §6.5 DLP gate). */
const policyRouter = t.router({
  modelRules: publicProcedure.query(() => ({
    rules: [
      { clearance: "public" as const, allowedKinds: ["closed", "self_hosted"] as const, description: "All models available" },
      { clearance: "internal" as const, allowedKinds: ["closed", "self_hosted"] as const, description: "All models available" },
      { clearance: "confidential" as const, allowedKinds: ["self_hosted"] as const, description: "Closed external models blocked — self-hosted only" },
      { clearance: "restricted" as const, allowedKinds: ["self_hosted"] as const, description: "Highest sensitivity — self-hosted only, full audit" },
    ],
  })),

  scopeCompliance: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const agents = agentsInScope(scope);
      const restricted = agents.filter(
        (a) => a.classificationClearance === "confidential" || a.classificationClearance === "restricted",
      );
      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        totalAgents: agents.length,
        restrictedAgents: restricted.length,
        restrictedPct: agents.length > 0 ? Math.round((restricted.length / agents.length) * 100) : 0,
        availableModels: [
          { model: "GLM-5.2", provider: "Self-hosted", kind: "self_hosted" as const },
          { model: "DeepSeek V3", provider: "Self-hosted", kind: "self_hosted" as const },
        ],
        blockedModels: [
          { model: "Claude Sonnet 4.5", provider: "Anthropic", kind: "closed" as const, reason: "Blocked for confidential/restricted" },
          { model: "GPT-4o", provider: "OpenAI", kind: "closed" as const, reason: "Blocked for confidential/restricted" },
        ],
      };
    }),
});

export const appRouter = t.router({
  health: healthRouter,
  orgTree: orgTreeRouter,
  agents: agentsRouter,
  spend: spendRouter,
  access: accessRouter,
  policy: policyRouter,
});

export type AppRouter = typeof appRouter;
