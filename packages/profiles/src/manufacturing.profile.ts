/**
 * Manufacturing company Industry Profile preset (D6).
 *
 * Pure data. Applies at tenant provisioning time. After provisioning, these
 * values become per-tenant config rows — runtime code never reads
 * `id: "manufacturing"`.
 *
 * The key difference from tech: deep org tree (Plant → Line/Cell → Station +
 * shift), OT resource types (MES/ERP/SCADA/historian), dual-axis classification
 * (sensitivity + regulatory flags like ITAR/EAR/GxP), edge/on-prem model
 * routing, shift-duty-roster stakeholder alerts, and manufacturing-specific
 * DLP patterns (process recipes, CAD geometry, tooling specs).
 *
 * Per D6 governing rule: NONE of this is mode-gated. A tech tenant can enable
 * OT resources; a manufacturing tenant can disable them. The profile only sets
 * defaults.
 */

import type { IndustryProfilePreset } from "./types";

export const manufacturingProfile: IndustryProfilePreset = {
  id: "manufacturing",
  label: "Manufacturing / Industrial",
  description:
    "Manufacturer: deep org tree (Plant → Line/Cell → Station + shift), OT resources, dual-axis classification (ITAR/EAR/GxP), edge/on-prem GPU first.",

  // ── Org-tree: HQ + multiple plants (real manufacturing structure) ──────
  orgTree: {
    style: "deep",
    description:
      "Corporate HQ + multiple plants, each with Production/Quality/Maintenance departments. Per-plant budgets, locations, and regulatory tags.",
    nodes: [
      // ── Corporate Headquarters ──
      {
        type: "hq",
        name: "Corporate Headquarters",
        location: "Detroit, MI",
        budgetMonthlyCents: 6000_00,
        children: [
          { type: "department", name: "Engineering", budgetMonthlyCents: 3000_00 },
          { type: "department", name: "Research & Development", budgetMonthlyCents: 1500_00 },
          { type: "department", name: "IT & OT-Security", budgetMonthlyCents: 800_00 },
          { type: "department", name: "Procurement & Supply Chain", budgetMonthlyCents: 700_00 },
        ],
      },
      // ── Plant Detroit (Michigan) — primary CNC + assembly ──
      {
        type: "plant",
        name: "Plant Detroit",
        location: "Detroit, MI, USA",
        budgetMonthlyCents: 8000_00,
        tags: { regulatory: "ITAR", shift_pattern: "3x12" },
        children: [
          {
            type: "department", name: "Production", budgetMonthlyCents: 4500_00,
            children: [
              { type: "line", name: "Line A — CNC Machining", budgetMonthlyCents: 2500_00 },
              { type: "line", name: "Line B — Assembly", budgetMonthlyCents: 2000_00 },
            ],
          },
          { type: "department", name: "Quality Control", budgetMonthlyCents: 1500_00 },
          { type: "department", name: "Maintenance", budgetMonthlyCents: 2000_00 },
        ],
      },
      // ── Plant Stuttgart (Germany) — precision engineering ──
      {
        type: "plant",
        name: "Plant Stuttgart",
        location: "Stuttgart, Germany",
        budgetMonthlyCents: 6000_00,
        tags: { regulatory: "EAR", shift_pattern: "3x8" },
        children: [
          {
            type: "department", name: "Production", budgetMonthlyCents: 3500_00,
            children: [
              { type: "line", name: "Line 1 — Precision Machining", budgetMonthlyCents: 2000_00 },
              { type: "line", name: "Line 2 — Testing", budgetMonthlyCents: 1500_00 },
            ],
          },
          { type: "department", name: "Quality Control", budgetMonthlyCents: 1500_00 },
          { type: "department", name: "Maintenance", budgetMonthlyCents: 1000_00 },
        ],
      },
      // ── Plant Shenzhen (China) — high-volume assembly ──
      {
        type: "plant",
        name: "Plant Shenzhen",
        location: "Shenzhen, China",
        budgetMonthlyCents: 4000_00,
        tags: { shift_pattern: "2x12" },
        children: [
          { type: "department", name: "Production", budgetMonthlyCents: 2500_00 },
          { type: "department", name: "Quality Control", budgetMonthlyCents: 1000_00 },
          { type: "department", name: "Logistics", budgetMonthlyCents: 500_00 },
        ],
      },
    ],
    // Legacy flat list (for backward compat with existing code)
    defaultDepartments: [
      { name: "Engineering", budgetMonthlyCents: 3000_00 },
      { name: "Research & Development", budgetMonthlyCents: 1500_00 },
      { name: "Plant Detroit — Production", budgetMonthlyCents: 4500_00 },
      { name: "Plant Detroit — QC", budgetMonthlyCents: 1500_00 },
      { name: "Plant Stuttgart — Production", budgetMonthlyCents: 3500_00 },
      { name: "Plant Shenzhen — Production", budgetMonthlyCents: 2500_00 },
    ],
  },

  // ── Personas ────────────────────────────────────────────────────────────
  personas: [
    { key: "plant_manager", label: "Plant Manager", defaultPanels: ["spend", "line_uptime", "maintenance_backlog", "quality_holds"] },
    { key: "shift_lead", label: "Shift Lead", defaultPanels: ["spend", "shift_handover", "line_uptime"] },
    { key: "maintenance_planner", label: "Maintenance Planner", defaultPanels: ["maintenance_backlog", "spend"] },
    { key: "qc_engineer", label: "QC / Process Engineer", defaultPanels: ["quality_holds", "spend", "audit"] },
    { key: "supply_chain", label: "Supply Chain", defaultPanels: ["spend", "demand_forecast"] },
    { key: "ot_security", label: "OT-Security", defaultPanels: ["audit", "access", "security"] },
    { key: "admin", label: "Admin", defaultPanels: ["spend", "agents", "access", "audit", "resources", "idp"] },
  ],

  // ── Resource types (cloud + OT) ─────────────────────────────────────────
  resourceTypes: {
    enabled: [
      "s3", "gcs", "db", "sharepoint", "onedrive", "files", "internal",
      // OT (operational technology) — capabilities any tenant can enable
      "mes", "erp", "scada", "historian", "plm", "cmms", "iot",
    ],
  },

  // ── Classification: dual-axis (sensitivity + regulatory) ────────────────
  classification: {
    axes: ["sensitivity", "regulatory"],
    levels: [
      { rank: 0, name: "public", regulatoryFlags: [] },
      { rank: 1, name: "internal", regulatoryFlags: [] },
      {
        rank: 2,
        name: "confidential",
        regulatoryFlags: ["ITAR", "EAR", "GxP"],
      },
      {
        rank: 3,
        name: "restricted",
        regulatoryFlags: ["ITAR", "EAR", "GxP"],
      },
    ],
  },

  // ── DLP patterns (PII + secrets + proprietary + export-controlled) ──────
  dlpPatterns: [
    // ── Standard (same as tech) ──
    {
      name: "SSN",
      pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      severity: "critical",
      category: "pii",
    },
    {
      name: "API Key (sk-ant-)",
      pattern: "sk-ant-[a-zA-Z0-9_-]{10,}",
      severity: "critical",
      category: "secrets",
    },
    {
      name: "API Key (sk-proj-)",
      pattern: "sk-proj-[a-zA-Z0-9_-]{10,}",
      severity: "critical",
      category: "secrets",
    },
    {
      name: "Credit Card",
      pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      severity: "warning",
      category: "financial",
    },
    // ── Manufacturing-specific: proprietary + export-controlled ──
    {
      name: "Process Recipe / BOM",
      pattern: "\\b(recipe|bill.?of.?materials|BOM)\\b.*[:=]\\s*\\S+",
      flags: "i",
      severity: "critical",
      category: "proprietary",
    },
    {
      name: "CAM / Tooling Parameters",
      pattern: "\\b(feed.?rate|spindle.?speed|tool.?path|G-?code)\\b.*[:=]?\\s*\\d",
      flags: "i",
      severity: "critical",
      category: "proprietary",
    },
    {
      name: "CAD Geometry Reference",
      pattern: "\\.(STEP|IGES|SLDPRT|IPT|DWG|DXF)\\b",
      flags: "i",
      severity: "warning",
      category: "proprietary",
    },
    {
      name: "Customer Spec / Quote",
      pattern: "\\b(customer.?spec|quote|pricing|cost.?(?:per.?unit|margin))\\b.*[:=]\\s*\\S+",
      flags: "i",
      severity: "warning",
      category: "proprietary",
    },
    {
      name: "Export-Controlled (ITAR/EAR)",
      pattern: "\\b(ITAR|EAR|export.?controlled|DDTC)\\b",
      flags: "i",
      severity: "critical",
      category: "export_controlled",
    },
  ],

  // ── Priority tiers (manufacturing naming) ───────────────────────────────
  tierLabels: {
    critical: "Line-blocking / line-down agent",
    standard: "CI / engineering agent",
    background: "Optimization / training / experiments",
  },

  // ── Budget periods (manufacturing: shift/line/batch granularity) ────────
  budgetPeriods: ["monthly", "shift", "line", "batch"],

  // ── Model routing (edge/on-prem GPU first for data residency) ───────────
  modelRouting: {
    strategy: "edge-onprep-first",
    description:
      "Edge / on-prem GPU first (data residency); geo-restricted for ITAR/EAR content.",
  },

  // ── Connectivity (air-gapped plants) ────────────────────────────────────
  connectivity: {
    assumption: "air-gapped",
    offlinePolicyTtl: true,
  },

  // ── Stakeholder routing (shift duty roster) ─────────────────────────────
  stakeholderRouting: {
    mode: "shift-duty-roster",
    description:
      "Single human of-record + shift duty roster for alerts / JIT approvals.",
  },

  // ── Seed agents (manufacturing-focused) ─────────────────────────────────
  seedAgents: [
    // Engineering — heavy LLM users, internal clearance
    { name: "CodeReview-Bot", type: "claude_code", departmentName: "Engineering", taskType: "code_review", clearance: "internal", tier: "critical", preferredModel: "qwen3.5" },
    { name: "DocGen-Agent", type: "opencode", departmentName: "Engineering", taskType: "documentation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "ArchDesign-Agent", type: "pi", departmentName: "Engineering", taskType: "architecture_design", clearance: "internal", tier: "standard", preferredModel: "qwen3.5" },
    // Plant Detroit — Production (confidential clearance, self-hosted only)
    { name: "ToolPath-Optimizer", type: "opencode", departmentName: "Production", taskType: "cnc_toolpath_optimization", clearance: "confidential", tier: "critical", preferredModel: "qwen3.5" },
    { name: "QualityAnalysis-Agent", type: "claude_code", departmentName: "Quality Control", taskType: "defect_analysis", clearance: "confidential", tier: "standard", preferredModel: "minicpm5-1b" },
    // Quality Control / Maintenance — mixed clearance
    { name: "TestGen-Agent", type: "copilot", departmentName: "Quality Control", taskType: "test_generation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "SecurityScan-Agent", type: "claude_code", departmentName: "Maintenance", taskType: "security_scan", clearance: "restricted", tier: "critical", preferredModel: "qwen3.5" },
    // Supply Chain — internal, cost-sensitive
    { name: "DemandForecast-Agent", type: "opencode", departmentName: "Supply Chain", taskType: "demand_forecasting", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "LogisticsOpt-Agent", type: "copilot", departmentName: "Supply Chain", taskType: "route_optimization", clearance: "internal", tier: "background", preferredModel: "minicpm5-1b" },
    // R&D — internal, experimental
    { name: "ResearchAssist-Agent", type: "pi", departmentName: "Research & Development", taskType: "research_synthesis", clearance: "internal", tier: "standard", preferredModel: "qwen3.5" },
  ],

  // ── UI home panels (manufacturing-specific + standard) ──────────────────
  uiPanels: [
    { key: "spend", label: "Spend Overview", order: 0 },
    { key: "line_uptime", label: "Line Uptime", order: 1 },
    { key: "maintenance_backlog", label: "Maintenance Backlog", order: 2 },
    { key: "quality_holds", label: "Quality Holds", order: 3 },
    { key: "shift_handover", label: "Shift Handover", order: 4 },
    { key: "demand_forecast", label: "Demand Forecast", order: 5 },
    { key: "agents", label: "Agent Fleet", order: 6 },
    { key: "access", label: "Access Control", order: 7 },
    { key: "audit", label: "Audit Trail", order: 8 },
    { key: "resources", label: "Resources", order: 9 },
    { key: "idp", label: "Identity Providers", order: 10 },
    { key: "plant_overview", label: "Plant Overview", order: 11 },
  ],

  // ── Role presets (D8) — who can restructure the org tree ──
  rolePresets: [
    {
      key: "org_admin", label: "Org Admin",
      description: "Full org-tree authority: create, rename, reparent, delete any node. Typically the Tenant admin / VP-Operations.",
      scopeType: "org", singleton: true,
      permissions: ["org_node:create", "org_node:rename", "org_node:reparent", "org_node:delete", "*"]
    },
    {
      key: "plant_manager", label: "Plant Manager",
      description: "Rename own plant; create + rename lines/teams within own plant. Cannot re-parent or delete.",
      scopeType: "plant",
      permissions: ["org_node:create", "org_node:rename"]
    },
    {
      key: "dept_head", label: "Department Head",
      description: "Rename own department; view-only elsewhere. Adept for VP/Director escalated to dept-head scope.",
      scopeType: "department",
      permissions: ["org_node:rename"]
    },
    {
      key: "viewer", label: "Viewer",
      description: "Read-only access to dashboards. No org-tree edits.",
      scopeType: "department",
      permissions: []
    },
  ],

  // ── Work-type taxonomies (D7) — per-department/per-plant label sets ──
  workTypeTaxonomies: [
    {
      departmentName: "Engineering",
      labels: [
        "code_review", "code_generation", "test_generation", "architecture_design",
        "hot_issue_resolution", "devops_automation", "dependency_upgrade",
      ],
    },
    {
      departmentName: "Production",
      labels: [
        "cnc_toolpath_optimization", "defect_analysis", "process_recipe_optimization",
        "predictive_maintenance", "line_balance_analysis", "spc_analysis",
        "cad_geometry_review", "quality_inspection",
      ],
      secondaryTagPresets: ["resource:mes", "resource:scada", "resource:plm"],
    },
    {
      departmentName: "Quality Control",
      labels: ["test_generation", "defect_analysis", "cybersecurity_scan", "compliance_review", "spc_analysis"],
    },
    {
      departmentName: "Supply Chain",
      labels: ["demand_forecasting", "route_optimization", "inventory_replenishment", "supplier_evaluation", "logistics_planning"],
    },
    {
      departmentName: "Research & Development",
      labels: ["research_synthesis", "experiment_design", "patent_analysis", "material_research"],
    },
  ],
};
