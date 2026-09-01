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
import { catalogRouter } from "./catalog-router.js";
import { libraryRouter } from "./library-router.js";
import { onboardingRouter } from "./onboarding-router.js";
import { adoptionRouter, isFixtureMode, queryClickHouseJSON } from "./adoption-router.js";
import { isDemoMode, snapshotAllDemoStores, restoreAllDemoStores } from "./demo-mode.js";

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

const tenantProcedure = t.procedure
  .use(async (opts) => {
    const { ctx } = opts;
    if (!ctx.claims || !ctx.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
      });
    }
    return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
  })
  .use(async (opts) => {
    if (!isDemoMode() || opts.type !== "mutation") return opts.next();
    const snapshot = snapshotAllDemoStores();
    try {
      return await opts.next();
    } finally {
      restoreAllDemoStores(snapshot);
    }
  });

const publicProcedure = t.procedure;

// ── Scope input type ───────────────────────────────────────────────────────

/** All scope types from the DB enum (packages/db/src/schema/enums.ts scopeTypeEnum).
 *  Widened from 4 to 9 in D6/D7/D8 to support plant/hq/organization/line nodes. */
const SCOPE_TYPES = [
  "org",
  "organization",
  "hq",
  "plant",
  "department",
  "group",
  "line",
  "cell",
  "team",
] as const;
type ScopeType = (typeof SCOPE_TYPES)[number];

const scopeInput = z
  .object({
    type: z.enum(SCOPE_TYPES),
    id: z.string(),
  })
  .nullable()
  .default(null);

type ScopeRef = { type: ScopeType; id: string } | null;

// ── Fixture: Org Tree (spec §4.1, §6.1) ────────────────────────────────────

interface ScopeNode {
  id: string;
  name: string;
  type: ScopeType;
  parentId: string | null;
  budgetCap: number;
  /** D8: physical location for plants/campuses. */
  location?: string | null;
  /** D8: metadata tags (e.g. regulatory: ITAR). */
  tags?: Record<string, string>;
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
  {
    id: "dept_eng",
    name: "Engineering",
    type: "department",
    parentId: "org_acme",
    budgetCap: 2500,
  },
  {
    id: "grp_prod_dsgn",
    name: "Product Design",
    type: "group",
    parentId: "dept_eng",
    budgetCap: 1500,
  },
  { id: "team_cad", name: "CAD Design", type: "team", parentId: "grp_prod_dsgn", budgetCap: 700 },
  { id: "team_sim", name: "Simulation", type: "team", parentId: "grp_prod_dsgn", budgetCap: 600 },
  { id: "grp_tooling", name: "Tooling", type: "group", parentId: "dept_eng", budgetCap: 800 },
  { id: "team_tool", name: "Tool Design", type: "team", parentId: "grp_tooling", budgetCap: 600 },
  // Manufacturing
  {
    id: "dept_mfg",
    name: "Manufacturing",
    type: "department",
    parentId: "org_acme",
    budgetCap: 4000,
  },
  {
    id: "grp_production",
    name: "Production",
    type: "group",
    parentId: "dept_mfg",
    budgetCap: 3000,
  },
  {
    id: "team_line_a",
    name: "Assembly Line A",
    type: "team",
    parentId: "grp_production",
    budgetCap: 1500,
  },
  {
    id: "team_line_b",
    name: "Assembly Line B",
    type: "team",
    parentId: "grp_production",
    budgetCap: 1200,
  },
  { id: "grp_maint", name: "Maintenance", type: "group", parentId: "dept_mfg", budgetCap: 1000 },
  { id: "team_pm", name: "Predictive Maint", type: "team", parentId: "grp_maint", budgetCap: 600 },
  // Quality Assurance
  {
    id: "dept_qa",
    name: "Quality Assurance",
    type: "department",
    parentId: "org_acme",
    budgetCap: 2500,
  },
  { id: "grp_inspection", name: "Inspection", type: "group", parentId: "dept_qa", budgetCap: 1800 },
  {
    id: "team_incoming",
    name: "Incoming QC",
    type: "team",
    parentId: "grp_inspection",
    budgetCap: 700,
  },
  { id: "team_final", name: "Final QC", type: "team", parentId: "grp_inspection", budgetCap: 1000 },
  { id: "grp_compliance", name: "Compliance", type: "group", parentId: "dept_qa", budgetCap: 600 },
  { id: "team_iso", name: "ISO Audit", type: "team", parentId: "grp_compliance", budgetCap: 400 },
  // Supply Chain
  {
    id: "dept_sc",
    name: "Supply Chain",
    type: "department",
    parentId: "org_acme",
    budgetCap: 2000,
  },
  {
    id: "grp_procurement",
    name: "Procurement",
    type: "group",
    parentId: "dept_sc",
    budgetCap: 1200,
  },
  {
    id: "team_raw",
    name: "Raw Materials",
    type: "team",
    parentId: "grp_procurement",
    budgetCap: 600,
  },
  {
    id: "team_components",
    name: "Components",
    type: "team",
    parentId: "grp_procurement",
    budgetCap: 600,
  },
  { id: "grp_logistics", name: "Logistics", type: "group", parentId: "dept_sc", budgetCap: 700 },
  {
    id: "team_warehouse",
    name: "Warehouse",
    type: "team",
    parentId: "grp_logistics",
    budgetCap: 500,
  },
  // R&D
  {
    id: "dept_rd",
    name: "Research & Development",
    type: "department",
    parentId: "org_acme",
    budgetCap: 2500,
  },
  {
    id: "grp_materials",
    name: "Materials Research",
    type: "group",
    parentId: "dept_rd",
    budgetCap: 1500,
  },
  {
    id: "team_metallurgy",
    name: "Metallurgy",
    type: "team",
    parentId: "grp_materials",
    budgetCap: 700,
  },
  {
    id: "team_polymers",
    name: "Polymers",
    type: "team",
    parentId: "grp_materials",
    budgetCap: 600,
  },
  {
    id: "grp_process",
    name: "Process Innovation",
    type: "group",
    parentId: "dept_rd",
    budgetCap: 800,
  },
  {
    id: "team_new_proc",
    name: "New Process",
    type: "team",
    parentId: "grp_process",
    budgetCap: 600,
  },
  // Sales & Marketing
  {
    id: "dept_sales",
    name: "Sales & Marketing",
    type: "department",
    parentId: "org_acme",
    budgetCap: 1800,
  },
  { id: "grp_sales", name: "Sales", type: "group", parentId: "dept_sales", budgetCap: 1000 },
  { id: "team_domestic", name: "Domestic", type: "team", parentId: "grp_sales", budgetCap: 500 },
  { id: "team_export", name: "Export", type: "team", parentId: "grp_sales", budgetCap: 500 },
  { id: "grp_mktg", name: "Marketing", type: "group", parentId: "dept_sales", budgetCap: 600 },
  { id: "team_digital", name: "Digital", type: "team", parentId: "grp_mktg", budgetCap: 400 },
  // Finance
  { id: "dept_fin", name: "Finance", type: "department", parentId: "org_acme", budgetCap: 2000 },
  {
    id: "grp_accounting",
    name: "Accounting",
    type: "group",
    parentId: "dept_fin",
    budgetCap: 1200,
  },
  { id: "team_ap_ar", name: "AP/AR", type: "team", parentId: "grp_accounting", budgetCap: 600 },
  {
    id: "team_cost",
    name: "Cost Accounting",
    type: "team",
    parentId: "grp_accounting",
    budgetCap: 600,
  },
  { id: "grp_treasury", name: "Treasury", type: "group", parentId: "dept_fin", budgetCap: 600 },
  { id: "team_cash", name: "Cash Mgmt", type: "team", parentId: "grp_treasury", budgetCap: 400 },
  // HR
  {
    id: "dept_hr",
    name: "Human Resources",
    type: "department",
    parentId: "org_acme",
    budgetCap: 1500,
  },
  { id: "grp_talent", name: "Talent", type: "group", parentId: "dept_hr", budgetCap: 800 },
  { id: "team_recruit", name: "Recruiting", type: "team", parentId: "grp_talent", budgetCap: 400 },
  { id: "team_onboard", name: "Onboarding", type: "team", parentId: "grp_talent", budgetCap: 300 },
  { id: "grp_people", name: "People Ops", type: "group", parentId: "dept_hr", budgetCap: 600 },
  { id: "team_payroll", name: "Payroll", type: "team", parentId: "grp_people", budgetCap: 400 },
  // IT & Digital
  {
    id: "dept_it",
    name: "IT & Digital",
    type: "department",
    parentId: "org_acme",
    budgetCap: 2200,
  },
  { id: "grp_infra", name: "Infrastructure", type: "group", parentId: "dept_it", budgetCap: 1400 },
  { id: "team_network", name: "Network", type: "team", parentId: "grp_infra", budgetCap: 700 },
  { id: "team_cloud", name: "Cloud", type: "team", parentId: "grp_infra", budgetCap: 500 },
  {
    id: "grp_data_plat",
    name: "Data Platform",
    type: "group",
    parentId: "dept_it",
    budgetCap: 600,
  },
  {
    id: "team_analytics",
    name: "Analytics",
    type: "team",
    parentId: "grp_data_plat",
    budgetCap: 500,
  },
  // Customer Service
  {
    id: "dept_cs",
    name: "Customer Service",
    type: "department",
    parentId: "org_acme",
    budgetCap: 1500,
  },
  { id: "grp_support", name: "Support", type: "group", parentId: "dept_cs", budgetCap: 900 },
  { id: "team_tech_sup", name: "Technical", type: "team", parentId: "grp_support", budgetCap: 500 },
  {
    id: "team_field",
    name: "Field Service",
    type: "team",
    parentId: "grp_support",
    budgetCap: 400,
  },
  { id: "grp_training", name: "Training", type: "group", parentId: "dept_cs", budgetCap: 400 },
  {
    id: "team_cust_trn",
    name: "Customer Training",
    type: "team",
    parentId: "grp_training",
    budgetCap: 300,
  },
];

const AGENTS: AgentFixture[] = [
  // Engineering: CAD Design
  {
    id: "agt_01",
    name: "cad-assistant",
    tier: "standard",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_cad",
    scopeLabel: "CAD Design",
    monthlySpend: 420,
    status: "active",
    taskType: "CAD model generation & validation",
    classificationClearance: "confidential",
  },
  {
    id: "agt_02",
    name: "drawing-checker",
    tier: "standard",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_cad",
    scopeLabel: "CAD Design",
    monthlySpend: 280,
    status: "active",
    taskType: "Engineering drawing compliance check",
    classificationClearance: "confidential",
  },
  // Engineering: Simulation
  {
    id: "agt_03",
    name: "fea-solver",
    tier: "standard",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_sim",
    scopeLabel: "Simulation",
    monthlySpend: 350,
    status: "active",
    taskType: "FEA stress analysis",
    classificationClearance: "confidential",
  },
  {
    id: "agt_04",
    name: "cfd-analyzer",
    tier: "background",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_sim",
    scopeLabel: "Simulation",
    monthlySpend: 180,
    status: "active",
    taskType: "CFD thermal simulation",
    classificationClearance: "confidential",
  },
  // Engineering: Tool Design
  {
    id: "agt_05",
    name: "toolpath-optimizer",
    tier: "standard",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_tool",
    scopeLabel: "Tool Design",
    monthlySpend: 310,
    status: "active",
    taskType: "CNC toolpath optimization",
    classificationClearance: "confidential",
  },
  {
    id: "agt_06",
    name: "die-designer",
    tier: "standard",
    stakeholder: "j.chen",
    scopeType: "team",
    scopeId: "team_tool",
    scopeLabel: "Tool Design",
    monthlySpend: 260,
    status: "active",
    taskType: "Die & mold CAD design",
    classificationClearance: "confidential",
  },
  // Manufacturing: Assembly Line A
  {
    id: "agt_07",
    name: "line-monitor-a",
    tier: "critical",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_line_a",
    scopeLabel: "Assembly Line A",
    monthlySpend: 890,
    status: "active",
    taskType: "Real-time line throughput monitoring",
    classificationClearance: "internal",
  },
  {
    id: "agt_08",
    name: "defect-detector-a",
    tier: "critical",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_line_a",
    scopeLabel: "Assembly Line A",
    monthlySpend: 720,
    status: "active",
    taskType: "Vision-based defect detection",
    classificationClearance: "confidential",
  },
  // Manufacturing: Assembly Line B
  {
    id: "agt_09",
    name: "line-monitor-b",
    tier: "standard",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_line_b",
    scopeLabel: "Assembly Line B",
    monthlySpend: 560,
    status: "active",
    taskType: "Production speed optimization",
    classificationClearance: "internal",
  },
  {
    id: "agt_10",
    name: "yield-optimizer",
    tier: "standard",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_line_b",
    scopeLabel: "Assembly Line B",
    monthlySpend: 340,
    status: "active",
    taskType: "First-pass yield improvement",
    classificationClearance: "confidential",
  },
  // Manufacturing: Predictive Maintenance
  {
    id: "agt_11",
    name: "vibration-analyzer",
    tier: "standard",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_pm",
    scopeLabel: "Predictive Maint",
    monthlySpend: 380,
    status: "active",
    taskType: "Vibration signature analysis",
    classificationClearance: "internal",
  },
  {
    id: "agt_12",
    name: "pm-scheduler",
    tier: "background",
    stakeholder: "s.ramos",
    scopeType: "team",
    scopeId: "team_pm",
    scopeLabel: "Predictive Maint",
    monthlySpend: 150,
    status: "active",
    taskType: "Preventive maintenance scheduling",
    classificationClearance: "internal",
  },
  // QA: Incoming QC
  {
    id: "agt_13",
    name: "material-inspector",
    tier: "standard",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_incoming",
    scopeLabel: "Incoming QC",
    monthlySpend: 290,
    status: "active",
    taskType: "Raw material batch inspection",
    classificationClearance: "confidential",
  },
  {
    id: "agt_14",
    name: "spec-checker",
    tier: "standard",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_incoming",
    scopeLabel: "Incoming QC",
    monthlySpend: 240,
    status: "active",
    taskType: "Specification compliance check",
    classificationClearance: "confidential",
  },
  // QA: Final QC
  {
    id: "agt_15",
    name: "visual-inspector",
    tier: "critical",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_final",
    scopeLabel: "Final QC",
    monthlySpend: 680,
    status: "active",
    taskType: "Final visual inspection",
    classificationClearance: "confidential",
  },
  {
    id: "agt_16",
    name: "dimension-checker",
    tier: "standard",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_final",
    scopeLabel: "Final QC",
    monthlySpend: 320,
    status: "active",
    taskType: "Dimensional tolerance verification",
    classificationClearance: "confidential",
  },
  // QA: ISO Audit
  {
    id: "agt_17",
    name: "audit-checker",
    tier: "standard",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_iso",
    scopeLabel: "ISO Audit",
    monthlySpend: 270,
    status: "active",
    taskType: "ISO 9001 compliance checklist",
    classificationClearance: "confidential",
  },
  {
    id: "agt_18",
    name: "cert-renewal-bot",
    tier: "background",
    stakeholder: "l.wu",
    scopeType: "team",
    scopeId: "team_iso",
    scopeLabel: "ISO Audit",
    monthlySpend: 130,
    status: "active",
    taskType: "Certification renewal tracking",
    classificationClearance: "internal",
  },
  // Supply Chain: Raw Materials
  {
    id: "agt_19",
    name: "price-tracker",
    tier: "standard",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_raw",
    scopeLabel: "Raw Materials",
    monthlySpend: 250,
    status: "active",
    taskType: "Commodity price monitoring",
    classificationClearance: "internal",
  },
  {
    id: "agt_20",
    name: "vendor-evaluator",
    tier: "background",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_raw",
    scopeLabel: "Raw Materials",
    monthlySpend: 140,
    status: "active",
    taskType: "Supplier performance scoring",
    classificationClearance: "internal",
  },
  // Supply Chain: Components
  {
    id: "agt_21",
    name: "bom-optimizer",
    tier: "standard",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_components",
    scopeLabel: "Components",
    monthlySpend: 360,
    status: "active",
    taskType: "BOM cost optimization",
    classificationClearance: "confidential",
  },
  {
    id: "agt_22",
    name: "lead-time-tracker",
    tier: "background",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_components",
    scopeLabel: "Components",
    monthlySpend: 120,
    status: "active",
    taskType: "Supplier lead time tracking",
    classificationClearance: "internal",
  },
  // Supply Chain: Warehouse
  {
    id: "agt_23",
    name: "inventory-optimizer",
    tier: "standard",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_warehouse",
    scopeLabel: "Warehouse",
    monthlySpend: 330,
    status: "active",
    taskType: "Inventory level optimization",
    classificationClearance: "internal",
  },
  {
    id: "agt_24",
    name: "pick-route-planner",
    tier: "background",
    stakeholder: "m.patel",
    scopeType: "team",
    scopeId: "team_warehouse",
    scopeLabel: "Warehouse",
    monthlySpend: 110,
    status: "active",
    taskType: "Pick-and-pack route planning",
    classificationClearance: "internal",
  },
  // R&D: Metallurgy
  {
    id: "agt_25",
    name: "alloy-analyzer",
    tier: "standard",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_metallurgy",
    scopeLabel: "Metallurgy",
    monthlySpend: 410,
    status: "active",
    taskType: "Alloy composition analysis",
    classificationClearance: "restricted",
  },
  {
    id: "agt_26",
    name: "stress-tester",
    tier: "standard",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_metallurgy",
    scopeLabel: "Metallurgy",
    monthlySpend: 340,
    status: "active",
    taskType: "Tensile & fatigue testing",
    classificationClearance: "restricted",
  },
  // R&D: Polymers
  {
    id: "agt_27",
    name: "compound-formulator",
    tier: "standard",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_polymers",
    scopeLabel: "Polymers",
    monthlySpend: 380,
    status: "active",
    taskType: "Polymer compound formulation",
    classificationClearance: "restricted",
  },
  {
    id: "agt_28",
    name: "durability-tester",
    tier: "background",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_polymers",
    scopeLabel: "Polymers",
    monthlySpend: 190,
    status: "active",
    taskType: "Accelerated aging tests",
    classificationClearance: "restricted",
  },
  // R&D: New Process
  {
    id: "agt_29",
    name: "process-simulator",
    tier: "standard",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_new_proc",
    scopeLabel: "New Process",
    monthlySpend: 460,
    status: "active",
    taskType: "Manufacturing process simulation",
    classificationClearance: "restricted",
  },
  {
    id: "agt_30",
    name: "yield-predictor",
    tier: "background",
    stakeholder: "k.yamamoto",
    scopeType: "team",
    scopeId: "team_new_proc",
    scopeLabel: "New Process",
    monthlySpend: 210,
    status: "active",
    taskType: "Production yield prediction",
    classificationClearance: "restricted",
  },
  // Sales: Domestic
  {
    id: "agt_31",
    name: "quote-generator",
    tier: "standard",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_domestic",
    scopeLabel: "Domestic",
    monthlySpend: 280,
    status: "active",
    taskType: "Customer quote generation",
    classificationClearance: "internal",
  },
  {
    id: "agt_32",
    name: "crm-updater",
    tier: "background",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_domestic",
    scopeLabel: "Domestic",
    monthlySpend: 90,
    status: "active",
    taskType: "CRM data enrichment",
    classificationClearance: "internal",
  },
  // Sales: Export
  {
    id: "agt_33",
    name: "trade-compliance",
    tier: "standard",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_export",
    scopeLabel: "Export",
    monthlySpend: 310,
    status: "active",
    taskType: "Export regulation compliance",
    classificationClearance: "confidential",
  },
  {
    id: "agt_34",
    name: "forex-hedger",
    tier: "background",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_export",
    scopeLabel: "Export",
    monthlySpend: 160,
    status: "active",
    taskType: "FX risk assessment",
    classificationClearance: "confidential",
  },
  // Marketing: Digital
  {
    id: "agt_35",
    name: "content-gen",
    tier: "standard",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_digital",
    scopeLabel: "Digital",
    monthlySpend: 220,
    status: "active",
    taskType: "Technical content generation",
    classificationClearance: "internal",
  },
  {
    id: "agt_36",
    name: "seo-optimizer",
    tier: "background",
    stakeholder: "a.garcia",
    scopeType: "team",
    scopeId: "team_digital",
    scopeLabel: "Digital",
    monthlySpend: 110,
    status: "active",
    taskType: "SEO meta optimization",
    classificationClearance: "internal",
  },
  // Finance: AP/AR
  {
    id: "agt_37",
    name: "invoice-processor",
    tier: "standard",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_ap_ar",
    scopeLabel: "AP/AR",
    monthlySpend: 260,
    status: "active",
    taskType: "Invoice processing & matching",
    classificationClearance: "confidential",
  },
  {
    id: "agt_38",
    name: "recon-bot",
    tier: "standard",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_ap_ar",
    scopeLabel: "AP/AR",
    monthlySpend: 180,
    status: "active",
    taskType: "Bank reconciliation",
    classificationClearance: "confidential",
  },
  // Finance: Cost Accounting
  {
    id: "agt_39",
    name: "cost-analyzer",
    tier: "standard",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_cost",
    scopeLabel: "Cost Accounting",
    monthlySpend: 320,
    status: "active",
    taskType: "Manufacturing cost analysis",
    classificationClearance: "confidential",
  },
  {
    id: "agt_40",
    name: "variance-reporter",
    tier: "background",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_cost",
    scopeLabel: "Cost Accounting",
    monthlySpend: 140,
    status: "active",
    taskType: "Budget vs actual variance",
    classificationClearance: "internal",
  },
  // Finance: Treasury
  {
    id: "agt_41",
    name: "cash-forecaster",
    tier: "standard",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_cash",
    scopeLabel: "Cash Mgmt",
    monthlySpend: 290,
    status: "active",
    taskType: "Cash flow forecasting",
    classificationClearance: "confidential",
  },
  {
    id: "agt_42",
    name: "credit-monitor",
    tier: "background",
    stakeholder: "r.smith",
    scopeType: "team",
    scopeId: "team_cash",
    scopeLabel: "Cash Mgmt",
    monthlySpend: 120,
    status: "active",
    taskType: "Customer credit monitoring",
    classificationClearance: "confidential",
  },
  // HR: Recruiting
  {
    id: "agt_43",
    name: "resume-screener",
    tier: "standard",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_recruit",
    scopeLabel: "Recruiting",
    monthlySpend: 190,
    status: "active",
    taskType: "Resume screening & ranking",
    classificationClearance: "confidential",
  },
  {
    id: "agt_44",
    name: "interview-scheduler",
    tier: "background",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_recruit",
    scopeLabel: "Recruiting",
    monthlySpend: 80,
    status: "active",
    taskType: "Interview scheduling automation",
    classificationClearance: "internal",
  },
  // HR: Onboarding
  {
    id: "agt_45",
    name: "onboarding-assist",
    tier: "standard",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_onboard",
    scopeLabel: "Onboarding",
    monthlySpend: 150,
    status: "active",
    taskType: "New hire onboarding checklist",
    classificationClearance: "confidential",
  },
  {
    id: "agt_46",
    name: "doc-collector",
    tier: "background",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_onboard",
    scopeLabel: "Onboarding",
    monthlySpend: 70,
    status: "active",
    taskType: "Onboarding document collection",
    classificationClearance: "confidential",
  },
  // HR: Payroll
  {
    id: "agt_47",
    name: "payroll-validator",
    tier: "standard",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_payroll",
    scopeLabel: "Payroll",
    monthlySpend: 230,
    status: "active",
    taskType: "Payroll calculation validation",
    classificationClearance: "confidential",
  },
  {
    id: "agt_48",
    name: "tax-filer",
    tier: "background",
    stakeholder: "t.johnson",
    scopeType: "team",
    scopeId: "team_payroll",
    scopeLabel: "Payroll",
    monthlySpend: 100,
    status: "active",
    taskType: "Payroll tax filing",
    classificationClearance: "confidential",
  },
  // IT: Network
  {
    id: "agt_49",
    name: "network-monitor",
    tier: "standard",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_network",
    scopeLabel: "Network",
    monthlySpend: 340,
    status: "active",
    taskType: "Network performance monitoring",
    classificationClearance: "internal",
  },
  {
    id: "agt_50",
    name: "security-scanner",
    tier: "critical",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_network",
    scopeLabel: "Network",
    monthlySpend: 520,
    status: "active",
    taskType: "Vulnerability scanning",
    classificationClearance: "confidential",
  },
  // IT: Cloud
  {
    id: "agt_51",
    name: "cloud-cost-opt",
    tier: "standard",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_cloud",
    scopeLabel: "Cloud",
    monthlySpend: 310,
    status: "active",
    taskType: "Cloud resource cost optimization",
    classificationClearance: "internal",
  },
  {
    id: "agt_52",
    name: "backup-checker",
    tier: "background",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_cloud",
    scopeLabel: "Cloud",
    monthlySpend: 90,
    status: "active",
    taskType: "Backup verification & reporting",
    classificationClearance: "internal",
  },
  // IT: Analytics
  {
    id: "agt_53",
    name: "etl-watcher",
    tier: "standard",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_analytics",
    scopeLabel: "Analytics",
    monthlySpend: 270,
    status: "active",
    taskType: "ETL pipeline monitoring",
    classificationClearance: "internal",
  },
  {
    id: "agt_54",
    name: "data-pipe-monitor",
    tier: "background",
    stakeholder: "d.lee",
    scopeType: "team",
    scopeId: "team_analytics",
    scopeLabel: "Analytics",
    monthlySpend: 180,
    status: "disabled",
    taskType: "Data pipeline health checks",
    classificationClearance: "internal",
  },
  // Customer Service: Technical
  {
    id: "agt_55",
    name: "warranty-processor",
    tier: "standard",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_tech_sup",
    scopeLabel: "Technical",
    monthlySpend: 240,
    status: "active",
    taskType: "Warranty claim processing",
    classificationClearance: "internal",
  },
  {
    id: "agt_56",
    name: "faq-bot",
    tier: "standard",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_tech_sup",
    scopeLabel: "Technical",
    monthlySpend: 190,
    status: "active",
    taskType: "Customer FAQ automation",
    classificationClearance: "internal",
  },
  // Customer Service: Field Service
  {
    id: "agt_57",
    name: "dispatch-optimizer",
    tier: "standard",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_field",
    scopeLabel: "Field Service",
    monthlySpend: 280,
    status: "active",
    taskType: "Field service dispatch routing",
    classificationClearance: "internal",
  },
  {
    id: "agt_58",
    name: "parts-tracker",
    tier: "background",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_field",
    scopeLabel: "Field Service",
    monthlySpend: 130,
    status: "active",
    taskType: "Spare parts inventory tracking",
    classificationClearance: "internal",
  },
  // Customer Service: Customer Training
  {
    id: "agt_59",
    name: "manual-generator",
    tier: "background",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_cust_trn",
    scopeLabel: "Customer Training",
    monthlySpend: 110,
    status: "active",
    taskType: "User manual generation",
    classificationClearance: "internal",
  },
  {
    id: "agt_60",
    name: "video-script-writer",
    tier: "background",
    stakeholder: "c.nunez",
    scopeType: "team",
    scopeId: "team_cust_trn",
    scopeLabel: "Customer Training",
    monthlySpend: 140,
    status: "active",
    taskType: "Training video scriptwriting",
    classificationClearance: "internal",
  },
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

// ── Model identity (shared by the fixture and ClickHouse spend paths) ──────

/**
 * Classifies a raw `model_id` into the display name, provider and openness
 * the spend panels show.
 *
 * ClickHouse stores whatever the proxy was called with —
 * `claude-sonnet-4-20250514`, `gpt-4o`, `glm-5.2` — while the fixtures carry
 * marketing names. Both paths route through here so the two modes tell the
 * same story, which is the repo's standing rule for fixture vs real.
 *
 * `kind` is the load-bearing field: `self_hosted` is what lets a confidential
 * or restricted workload run at all, so an unrecognised model is deliberately
 * NOT assumed to be self-hosted. Unknown means closed, because guessing the
 * other way would understate the exposure of traffic nobody has classified.
 */
export function classifyModel(modelId: string): {
  model: string;
  provider: string;
  kind: "closed" | "self_hosted";
  /** Bucket the trend chart plots. */
  bucket: "claude" | "gpt" | "glm";
} {
  const id = modelId.toLowerCase();
  if (id.startsWith("claude")) {
    return { model: modelId, provider: "Anthropic", kind: "closed", bucket: "claude" };
  }
  if (id.startsWith("gpt") || /^o[1-9]/.test(id)) {
    return { model: modelId, provider: "OpenAI", kind: "closed", bucket: "gpt" };
  }
  if (id.startsWith("glm") || id.startsWith("deepseek") || id.startsWith("qwen")) {
    return { model: modelId, provider: "Self-hosted", kind: "self_hosted", bucket: "glm" };
  }
  return { model: modelId, provider: "Unknown", kind: "closed", bucket: "gpt" };
}

/**
 * SQL-quotes a string for the ClickHouse queries below. Every value that
 * reaches these queries is either a `tenant_id` resolved by `tenantProcedure`
 * or an agent id read back from Postgres — never raw client input — but the
 * quoting is here so that stays true if a caller changes.
 */
function chLiteral(v: string): string {
  return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Resolves a scope to the agent ids under it, for filtering `token_usage_event`.
 *
 * `token_usage_event` carries `tenant_id`, `agent_id` and `sub_account_id` but
 * no org-node column — the org tree lives in Postgres. So a scoped spend query
 * is a two-store question: which agents are under this node (Postgres), then
 * what did those agents cost (ClickHouse).
 *
 * Returns null for the org root, meaning "no agent filter, tenant only".
 */
async function agentIdsInScope(
  tenantId: string,
  scope: { type: string; id: string } | null | undefined,
): Promise<string[] | null> {
  if (!scope || scope.type === "org") return null;
  const { getDb, agentTable } = await import("@arm/db");
  const { eq, and } = await import("drizzle-orm");
  const rows = await getDb()
    .select({ id: agentTable.id })
    .from(agentTable)
    .where(and(eq(agentTable.tenantId, tenantId), eq(agentTable.scopeId, scope.id)));
  return rows.map((r) => r.id);
}

/** `AND agent_id IN (…)`, or empty when the scope covers the whole tenant. */
function agentFilterSQL(agentIds: string[] | null): string {
  if (agentIds === null) return "";
  // An empty scope must match nothing, not everything — `IN ()` is a syntax
  // error in ClickHouse, so this is spelled out rather than left to chance.
  if (agentIds.length === 0) return " AND 1 = 0";
  return ` AND agent_id IN (${agentIds.map(chLiteral).join(", ")})`;
}

const FIXTURE_ACCESS_REQUESTS = [
  {
    id: "req_01",
    agentId: "cad-assistant",
    resourceId: "s3://engineering/cad-files/",
    status: "pending",
    action: "read",
    reason: "Review new product CAD models (confidential)",
  },
  {
    id: "req_02",
    agentId: "cost-analyzer",
    resourceId: "db://erp/manufacturing_costs",
    status: "pending",
    action: "query",
    reason: "Monthly cost variance analysis",
  },
];

const telemetryState = initTelemetry("control-plane");

// ── Tree helpers ───────────────────────────────────────────────────────────

function resolveScope(ref: ScopeRef): ScopeNode {
  if (!ref) return SCOPES.find((s) => s.type === "org")!;
  return (
    SCOPES.find((s) => s.id === ref.id && s.type === ref.type) ??
    (() => {
      throw new TRPCError({ code: "NOT_FOUND", message: `Scope ${ref.type}:${ref.id} not found` });
    })()
  );
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
  path: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    const scope = resolveScope(opts.input.scope);
    return {
      tenantId: opts.ctx.tenantId!,
      path: scopePath(scope).map((s) => ({ id: s.id, name: s.name, type: s.type })),
    };
  }),

  /** Returns immediate child scopes of the given scope (or org root). */
  children: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
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
    return {
      tenantId: opts.ctx.tenantId!,
      scope: { id: scope.id, name: scope.name, type: scope.type },
      children,
    };
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
  workTypes: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    const scope = resolveScope(opts.input.scope);
    const agents = agentsInScope(scope);
    // Group by first 2 words of taskType
    const byCategory = new Map<string, { count: number; spend: number }>();
    for (const a of agents) {
      const cat = a.taskType
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .replace(/[&,].*$/, "")
        .trim();
      const entry = byCategory.get(cat) ?? { count: 0, spend: 0 };
      entry.count++;
      entry.spend += a.monthlySpend;
      byCategory.set(cat, entry);
    }
    const workTypes = [...byCategory.entries()]
      .map(([category, stats]) => ({ category, agentCount: stats.count, spend: stats.spend }))
      .sort((a, b) => b.spend - a.spend);
    const classes: Record<string, number> = {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
    };
    for (const a of agents) {
      const k = a.classificationClearance;
      classes[k] = (classes[k] ?? 0) + 1;
    }
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

  /** D8: Mutate the org tree (create/rename/reparent/delete a node).
   *
   *  Permission-checked via canMutateOrgNode(). Only org_admin can reparent
   *  or delete; create/rename may be delegated to plant_manager etc.
   *
   *  Every mutation is logged to orgMutationLogTable.
   *
   *  NOTE: This is the LIVE mutation endpoint. In the fixture-only dev build,
   *  it validates inputs + permissions but operates on an in-memory tree
   *  overlay (no real DB). When a real Postgres is wired, these become
   *  real INSERT/UPDATE/DELETE on the departments table.
   */
  mutate: tenantProcedure
    .input(
      z.object({
        verb: z.enum(["create", "rename", "reparent", "delete"]),
        parentId: z.string().optional(), // for create
        nodeId: z.string().optional(), // for rename/reparent/delete
        name: z.string().optional(), // for create/rename
        type: z.enum(SCOPE_TYPES).optional(), // for create
        location: z.string().optional(), // for create
        budgetMonthlyCents: z.number().optional(), // for create
        newParentId: z.string().optional(), // for reparent
        reason: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      const { verb } = opts.input;

      // Permission check (fixture: dev user has org_admin-equivalent in dev mode)
      // In production this reads resolved roles from userRoleTable.
      const verbMap: Record<string, string> = {
        create: "org_node:create",
        rename: "org_node:rename",
        reparent: "org_node:reparent",
        delete: "org_node:delete",
      };

      return {
        tenantId: opts.ctx.tenantId!,
        verb,
        permission: verbMap[verb]!,
        status: "authorized" as const,
        // In dev mode, always authorized (no real DB to check against).
        // In production: canMutateOrgNode(resolvedRoles, verb, targetScope).
        detail: `Mutation '${verb}' authorized in dev mode. Wire to real DB for production enforcement.`,
        timestamp: new Date().toISOString(),
      };
    }),
});

// ── Roles router (D8) ─────────────────────────────────────────────────────

/** Role preset fixture — mirrors what the simulation seeds from the profile. */
interface RolePreset {
  key: string;
  label: string;
  description: string;
  scopeType: ScopeType;
  permissions: string[];
  singleton?: boolean;
}

const ROLE_PRESETS: RolePreset[] = [
  {
    key: "org_admin",
    label: "Org Admin",
    description: "Full org-tree authority: create, rename, reparent, delete any node.",
    scopeType: "org",
    singleton: true,
    permissions: [
      "org_node:create",
      "org_node:rename",
      "org_node:reparent",
      "org_node:delete",
      "*",
    ],
  },
  {
    key: "subsidiary_admin",
    label: "Subsidiary Admin",
    description: "Restructure WITHIN their subsidiary: add plants, departments.",
    scopeType: "organization",
    permissions: ["org_node:create", "org_node:rename"],
  },
  {
    key: "plant_manager",
    label: "Plant Manager",
    description: "Rename own plant; create + rename lines within own plant.",
    scopeType: "plant",
    permissions: ["org_node:create", "org_node:rename"],
  },
  {
    key: "dept_head",
    label: "Department Head",
    description: "Rename own department; view-only elsewhere.",
    scopeType: "department",
    permissions: ["org_node:rename"],
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access to dashboards.",
    scopeType: "department",
    permissions: [],
  },
];

const rolesRouter = t.router({
  /** List all role presets available for this tenant. */
  list: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      roles: ROLE_PRESETS.map((r) => ({
        key: r.key,
        label: r.label,
        description: r.description,
        scopeType: r.scopeType,
        permissions: r.permissions,
        singleton: r.singleton ?? false,
      })),
    };
  }),

  /** List org-node permission verbs (for the permission editor UI). */
  permissions: tenantProcedure.query(async () => {
    return {
      verbs: [
        {
          key: "org_node:create",
          label: "Create nodes",
          description: "Add child nodes (plants, departments, lines)",
        },
        { key: "org_node:rename", label: "Rename nodes", description: "Rename nodes within scope" },
        {
          key: "org_node:reparent",
          label: "Reparent nodes",
          description: "Move nodes to a different parent (org_admin only)",
        },
        {
          key: "org_node:delete",
          label: "Delete nodes",
          description: "Remove nodes with no active agents (org_admin only)",
        },
      ],
    };
  }),

  /** Grant a role to a user at a scope. */
  grant: tenantProcedure
    .input(
      z.object({
        userId: z.string(),
        roleKey: z.string(),
        scopeType: z.enum(SCOPE_TYPES),
        scopeId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      return {
        tenantId: opts.ctx.tenantId!,
        status: "granted" as const,
        detail: `Role '${opts.input.roleKey}' granted to user '${opts.input.userId}' at ${opts.input.scopeType}:${opts.input.scopeId}`,
      };
    }),

  /** Revoke a role from a user. */
  revoke: tenantProcedure
    .input(
      z.object({
        userId: z.string(),
        roleKey: z.string(),
        scopeId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      return {
        tenantId: opts.ctx.tenantId!,
        status: "revoked" as const,
        detail: `Role '${opts.input.roleKey}' revoked from user '${opts.input.userId}' at scope '${opts.input.scopeId}'`,
      };
    }),

  /** Audit log of org-tree mutations. */
  auditLog: tenantProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async (opts) => {
      // Fixture: empty in dev mode. Production reads orgMutationLogTable.
      return {
        tenantId: opts.ctx.tenantId!,
        entries: [],
      };
    }),
});

const spendRouter = t.router({
  summary: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
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

  /** Spend per model. Real mode reads `token_usage_event` — the table the
   *  proxy → meter-agent → ingest pipeline writes to. */
  byModel: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    if (!isFixtureMode()) {
      const tenantId = opts.ctx.tenantId!;
      const agentIds = await agentIdsInScope(tenantId, opts.input.scope);
      const rows = await queryClickHouseJSON<{ model_id: string; spend: string }>(
        `SELECT model_id, sum(cost_usd) AS spend
           FROM token_usage_event
          WHERE tenant_id = ${chLiteral(tenantId)}${agentFilterSQL(agentIds)}
          GROUP BY model_id
          ORDER BY spend DESC
          LIMIT 20`,
      );
      return {
        tenantId,
        models: rows.map((r) => {
          const { model, provider, kind } = classifyModel(r.model_id);
          return { model, provider, spend: Number(r.spend), kind };
        }),
      };
    }
    return { tenantId: opts.ctx.tenantId!, models: FIXTURE_MODEL_SPEND };
  }),

  /** Daily spend split into the three buckets the trend chart plots. */
  trend: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    if (!isFixtureMode()) {
      const tenantId = opts.ctx.tenantId!;
      const agentIds = await agentIdsInScope(tenantId, opts.input.scope);
      const rows = await queryClickHouseJSON<{ d: string; model_id: string; spend: string }>(
        `SELECT toDate(ts) AS d, model_id, sum(cost_usd) AS spend
           FROM token_usage_event
          WHERE tenant_id = ${chLiteral(tenantId)}
            AND ts >= now() - INTERVAL 30 DAY${agentFilterSQL(agentIds)}
          GROUP BY d, model_id
          ORDER BY d ASC`,
      );
      // Bucket by day so the chart's shape is identical in both modes. A day
      // with traffic from only one provider still emits zeros for the others,
      // otherwise the line chart draws gaps where the answer is "nothing".
      const byDay = new Map<string, { date: string; claude: number; gpt: number; glm: number }>();
      for (const row of rows) {
        const point = byDay.get(row.d) ?? { date: row.d, claude: 0, gpt: 0, glm: 0 };
        point[classifyModel(row.model_id).bucket] += Number(row.spend);
        byDay.set(row.d, point);
      }
      return { tenantId, points: [...byDay.values()] };
    }
    return { tenantId: opts.ctx.tenantId!, points: FIXTURE_SPEND_TREND };
  }),

  modelMix: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    const scope = resolveScope(opts.input.scope);
    const agents = agentsInScope(scope);
    const byModel = new Map<string, { count: number; spend: number }>();
    for (const a of agents) {
      // Confidential/restricted agents must use self-hosted; the rest are
      // split across the two closed models.
      //
      // That split used to be `Math.random() > 0.5`, evaluated per request —
      // so the model-mix panel showed different numbers on every refresh and
      // no two screenshots of the same tenant ever agreed. Deriving it from
      // the agent id keeps the same spread while making the panel stable,
      // which is also what makes it screenshottable for the demo.
      const closedModel =
        [...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) % 2 === 0
          ? "Claude Sonnet 4.5"
          : "GPT-4o";
      const model =
        a.classificationClearance === "confidential" || a.classificationClearance === "restricted"
          ? "GLM-5.2"
          : closedModel;
      const entry = byModel.get(model) ?? { count: 0, spend: 0 };
      entry.count++;
      entry.spend += a.monthlySpend;
      byModel.set(model, entry);
    }
    const models = [...byModel.entries()]
      .map(([model, stats]) => ({
        model,
        modelKind: model === "GLM-5.2" ? "self_hosted" : "closed",
        agentCount: stats.count,
        spend: stats.spend,
        pct: Math.round((stats.count / agents.length) * 100),
      }))
      .sort((a, b) => b.spend - a.spend);
    return {
      tenantId: opts.ctx.tenantId!,
      scope: { id: scope.id, name: scope.name, type: scope.type },
      models,
    };
  }),

  /** Hosting cost model — cost of running self-hosted inference (spec §7.2). */
  hostingCost: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      models: [
        {
          model: "GLM-5.2",
          provider: "Self-hosted",
          gpuHours: 420,
          costPerHour: 1.2,
          monthlyCost: 504,
          instance: "A100×2",
        },
        {
          model: "DeepSeek V3",
          provider: "Self-hosted",
          gpuHours: 180,
          costPerHour: 0.8,
          monthlyCost: 144,
          instance: "A10G×4",
        },
      ],
      totalHostingCost: 648,
      savingsVsApi: 16170 - 648, // if all traffic moved to self-hosted
    };
  }),

  /** Live snapshot — last-known metering state (polling-driven "realtime"). */
  liveSnapshot: tenantProcedure.query(async () => {
    return {
      timestamp: new Date().toISOString(),
      spendTodayUsd: 542.3,
      requestsToday: 1842,
      activeAgents: 58,
      blockedByGate: 4, // DLP gate blocked 4 calls today
      driftPct: 2.0,
      status: "ok" as const,
    };
  }),

  /** Savings estimator — how much if we switch scopes to open models (spec §8.3). */
  savingsEstimate: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    const scope = resolveScope(opts.input.scope);
    const agents = agentsInScope(scope);
    const totalSpend = agents.reduce((s, a) => s + a.monthlySpend, 0);
    // Estimate: 40% saving by switching to open models
    const potentialSavings = Math.round(totalSpend * 0.4);
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
      recommendation:
        potentialSavings > 0
          ? `Switch ${switchedAgents} agents to open models to save $${potentialSavings.toLocaleString()}/mo`
          : "No savings available",
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
    .input(
      z.object({ scope: scopeInput, status: z.enum(["active", "disabled", "all"]).default("all") }),
    )
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
  pendingApprovals: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    return { tenantId: opts.ctx.tenantId!, requests: FIXTURE_ACCESS_REQUESTS };
  }),

  requestAccess: tenantProcedure
    .input(
      z.object({
        resourceId: z.string(),
        actions: z.array(z.string()),
        reason: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      return { id: "req_new", tenantId: opts.ctx.tenantId!, status: "pending" };
    }),

  /** Approve a JIT access request. */
  approve: tenantProcedure.input(z.object({ requestId: z.string() })).mutation(async (opts) => {
    // TODO(Phase 2): UPDATE access_request SET status='approved', decided_at=NOW()
    return {
      id: opts.input.requestId,
      status: "approved",
      message: `Request ${opts.input.requestId} approved. Short-lived credential issued (15-min TTL).`,
    };
  }),

  /** Deny a JIT access request. */
  deny: tenantProcedure
    .input(z.object({ requestId: z.string(), reason: z.string().optional() }))
    .mutation(async (opts) => {
      return {
        id: opts.input.requestId,
        status: "denied",
        message: `Request ${opts.input.requestId} denied. ${opts.input.reason ?? "Access not granted."}`,
      };
    }),
});

/** GPU brokering router (spec §9 Phase 3) — self-hosted GPU capacity across tenants. */
const gpuRouter = t.router({
  capacity: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    pools: [
      {
        id: "gpu-1",
        name: "A100 Cluster",
        gpus: 8,
        allocatedGpus: 6,
        availableGpus: 2,
        model: "GLM-5.2",
        hourlyRate: 1.2,
        department: "IT & Digital",
      },
      {
        id: "gpu-2",
        name: "A10G Pool",
        gpus: 16,
        allocatedGpus: 10,
        availableGpus: 6,
        model: "DeepSeek V3",
        hourlyRate: 0.8,
        department: "Engineering",
      },
      {
        id: "gpu-3",
        name: "H100 Reserved",
        gpus: 4,
        allocatedGpus: 4,
        availableGpus: 0,
        model: "Custom Fine-tune",
        hourlyRate: 2.5,
        department: "R&D",
      },
    ],
    totalGpus: 28,
    totalAllocated: 20,
    totalAvailable: 8,
    monthlyCost: 648,
  })),
});

/** Anomaly detection router (spec §9 Phase 5) — statistical spend pattern analysis. */
const anomalyRouter = t.router({
  scan: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    anomalies: [
      {
        id: "anom-1",
        agentId: "line-monitor-a",
        agentName: "line-monitor-a",
        scope: "Manufacturing",
        severity: "warning" as const,
        description: "Spend increased 3.2× vs 7-day moving average. Today: $890, Avg: $278.",
        detectedAt: "2026-07-27T14:30:00Z",
        status: "open" as const,
      },
      {
        id: "anom-2",
        agentId: "alloy-analyzer",
        agentName: "alloy-analyzer",
        scope: "R&D",
        severity: "critical" as const,
        description:
          "Unusual model routing detected: RESTRICTED agent briefly attempted Claude access (blocked by DLP). 3 attempts in 1 hour.",
        detectedAt: "2026-07-27T13:15:00Z",
        status: "reviewing" as const,
      },
      {
        id: "anom-3",
        agentId: "invoice-processor",
        agentName: "invoice-processor",
        scope: "Finance",
        severity: "warning" as const,
        description:
          "Output token count 8× above baseline. Possible prompt injection or data extraction attempt.",
        detectedAt: "2026-07-27T11:45:00Z",
        status: "open" as const,
      },
      {
        id: "anom-4",
        agentId: "cad-assistant",
        agentName: "cad-assistant",
        scope: "Engineering",
        severity: "info" as const,
        description:
          "Request pattern changed: previously 90% read, now 60% read / 40% write. May indicate new workflow.",
        detectedAt: "2026-07-27T09:00:00Z",
        status: "acknowledged" as const,
      },
    ],
    summary: { totalAnomalies: 4, critical: 1, warning: 2, info: 1, openCount: 2 },
    scanTime: new Date().toISOString(),
  })),
});

const healthRouter = t.router({
  check: publicProcedure.query((): ServiceHealth =>
    getHealth("control-plane", telemetryState.active),
  ),
});

// ── Root router ────────────────────────────────────────────────────────────

/** Policy router — classification-gated model routing (spec §6.5 DLP gate). */
const policyRouter = t.router({
  modelRules: publicProcedure.query(() => ({
    rules: [
      {
        clearance: "public" as const,
        allowedKinds: ["closed", "self_hosted"] as const,
        description: "All models available",
      },
      {
        clearance: "internal" as const,
        allowedKinds: ["closed", "self_hosted"] as const,
        description: "All models available",
      },
      {
        clearance: "confidential" as const,
        allowedKinds: ["self_hosted"] as const,
        description: "Closed external models blocked — self-hosted only",
      },
      {
        clearance: "restricted" as const,
        allowedKinds: ["self_hosted"] as const,
        description: "Highest sensitivity — self-hosted only, full audit",
      },
    ],
  })),

  scopeCompliance: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    const scope = resolveScope(opts.input.scope);
    const agents = agentsInScope(scope);
    const restricted = agents.filter(
      (a) =>
        a.classificationClearance === "confidential" || a.classificationClearance === "restricted",
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
        {
          model: "Claude Sonnet 4.5",
          provider: "Anthropic",
          kind: "closed" as const,
          reason: "Blocked for confidential/restricted",
        },
        {
          model: "GPT-4o",
          provider: "OpenAI",
          kind: "closed" as const,
          reason: "Blocked for confidential/restricted",
        },
      ],
    };
  }),
});

/** Security router — risky operation flags (ARM differentiator). */
const FIXTURE_SECURITY_FLAGS = [
  {
    id: "sf1",
    severity: "critical" as const,
    category: "model_violation" as const,
    agentName: "alloy-analyzer",
    scope: "R&D / Metallurgy",
    description:
      "Agent with RESTRICTED clearance attempted to route to Claude (closed model). Call blocked by DLP gate.",
    timestamp: "2026-07-26T14:32:00Z",
    status: "reviewed" as const,
  },
  {
    id: "sf2",
    severity: "critical" as const,
    category: "data_access" as const,
    agentName: "payroll-validator",
    scope: "HR / Payroll",
    description:
      "Agent accessed employee compensation data outside approved window (03:14 UTC). Flagged for stakeholder review.",
    timestamp: "2026-07-27T03:14:00Z",
    status: "pending" as const,
  },
  {
    id: "sf3",
    severity: "warning" as const,
    category: "budget_breach" as const,
    agentName: "line-monitor-a",
    scope: "Manufacturing / Assembly Line A",
    description:
      "Agent exceeded daily budget cap of $50 — auto-throttled. Monthly total now at 95%%.",
    timestamp: "2026-07-27T09:45:00Z",
    status: "acknowledged" as const,
  },
  {
    id: "sf4",
    severity: "warning" as const,
    category: "permission_escalation" as const,
    agentName: "compound-formulator",
    scope: "R&D / Polymers",
    description:
      "Agent requested access to s3://engineering/cad-files/ without JIT approval. Request denied — elevated to team lead.",
    timestamp: "2026-07-26T16:22:00Z",
    status: "pending" as const,
  },
  {
    id: "sf5",
    severity: "info" as const,
    category: "unusual_pattern" as const,
    agentName: "security-scanner",
    scope: "IT / Network",
    description:
      "Agent query rate spiked 5× baseline. No policy violation detected but flagged for inspection.",
    timestamp: "2026-07-27T11:05:00Z",
    status: "acknowledged" as const,
  },
];

const securityRouter = t.router({
  flags: tenantProcedure.input(z.object({ scope: scopeInput })).query(async (opts) => {
    return { tenantId: opts.ctx.tenantId!, flags: FIXTURE_SECURITY_FLAGS };
  }),
});

// ── ROUTER REGISTRATION BLOCK — only the `server` agent edits below ──────────
// (docs/guides/00-shared-contracts.md §8; docs/guides/README.md file-ownership
// table: `packages/trpc/src/index.ts` router-registration block is the ONE
// part of this file `server` may touch. `library`/`onboarding`/`adoption` are
// placeholder routers landed by `contracts` (Wave 0) — see library-router.ts,
// onboarding-router.ts, adoption-router.ts. Each Wave-1 agent replaces its
// own router file's contents; none of them edit this registration block.)
export const appRouter = t.router({
  health: healthRouter,
  orgTree: orgTreeRouter,
  roles: rolesRouter,
  agents: agentsRouter,
  spend: spendRouter,
  access: accessRouter,
  policy: policyRouter,
  security: securityRouter,
  gpu: gpuRouter,
  anomaly: anomalyRouter,
  catalog: catalogRouter,
  library: libraryRouter,
  onboarding: onboardingRouter,
  adoption: adoptionRouter,
});
// ── END ROUTER REGISTRATION BLOCK ────────────────────────────────────────────

export type AppRouter = typeof appRouter;
