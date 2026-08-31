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

import type { IndustryProfilePreset } from "./types.js";
import { MANUFACTURING_JOB_FUNCTIONS } from "./job-taxonomy.manufacturing.js";

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
            type: "department",
            name: "Production",
            budgetMonthlyCents: 4500_00,
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
            type: "department",
            name: "Production",
            budgetMonthlyCents: 3500_00,
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
    {
      key: "plant_manager",
      label: "Plant Manager",
      defaultPanels: ["spend", "line_uptime", "maintenance_backlog", "quality_holds"],
    },
    {
      key: "shift_lead",
      label: "Shift Lead",
      defaultPanels: ["spend", "shift_handover", "line_uptime"],
    },
    {
      key: "maintenance_planner",
      label: "Maintenance Planner",
      defaultPanels: ["maintenance_backlog", "spend"],
    },
    {
      key: "qc_engineer",
      label: "QC / Process Engineer",
      defaultPanels: ["quality_holds", "spend", "audit"],
    },
    { key: "supply_chain", label: "Supply Chain", defaultPanels: ["spend", "demand_forecast"] },
    { key: "ot_security", label: "OT-Security", defaultPanels: ["audit", "access", "security"] },
    {
      key: "admin",
      label: "Admin",
      defaultPanels: ["spend", "agents", "access", "audit", "resources", "idp"],
    },
  ],

  // ── Resource types (cloud + OT) ─────────────────────────────────────────
  resourceTypes: {
    enabled: [
      "s3",
      "gcs",
      "db",
      "sharepoint",
      "onedrive",
      "files",
      "internal",
      // OT (operational technology) — capabilities any tenant can enable
      "mes",
      "erp",
      "scada",
      "historian",
      "plm",
      "cmms",
      "iot",
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
    description: "Edge / on-prem GPU first (data residency); geo-restricted for ITAR/EAR content.",
  },

  // ── Connectivity (air-gapped plants) ────────────────────────────────────
  connectivity: {
    assumption: "air-gapped",
    offlinePolicyTtl: true,
  },

  // ── Stakeholder routing (shift duty roster) ─────────────────────────────
  stakeholderRouting: {
    mode: "shift-duty-roster",
    description: "Single human of-record + shift duty roster for alerts / JIT approvals.",
  },

  // ── Seed agents (manufacturing-focused) ─────────────────────────────────
  seedAgents: [
    // Engineering — heavy LLM users, internal clearance
    {
      name: "CodeReview-Bot",
      type: "claude_code",
      departmentName: "Engineering",
      taskType: "code_review",
      clearance: "internal",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    {
      name: "DocGen-Agent",
      type: "opencode",
      departmentName: "Engineering",
      taskType: "documentation",
      clearance: "internal",
      tier: "standard",
      preferredModel: "minicpm5-1b",
    },
    {
      name: "ArchDesign-Agent",
      type: "pi",
      departmentName: "Engineering",
      taskType: "architecture_design",
      clearance: "internal",
      tier: "standard",
      preferredModel: "qwen3.5",
    },
    // Plant Detroit — Production (confidential clearance, self-hosted only)
    {
      name: "ToolPath-Optimizer",
      type: "opencode",
      departmentName: "Production",
      taskType: "cnc_toolpath_optimization",
      clearance: "confidential",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    {
      name: "QualityAnalysis-Agent",
      type: "claude_code",
      departmentName: "Quality Control",
      taskType: "defect_analysis",
      clearance: "confidential",
      tier: "standard",
      preferredModel: "minicpm5-1b",
    },
    // Quality Control / Maintenance — mixed clearance
    {
      name: "TestGen-Agent",
      type: "copilot",
      departmentName: "Quality Control",
      taskType: "test_generation",
      clearance: "internal",
      tier: "standard",
      preferredModel: "minicpm5-1b",
    },
    {
      name: "SecurityScan-Agent",
      type: "claude_code",
      departmentName: "Maintenance",
      taskType: "security_scan",
      clearance: "restricted",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    // Supply Chain — internal, cost-sensitive
    {
      name: "DemandForecast-Agent",
      type: "opencode",
      departmentName: "Supply Chain",
      taskType: "demand_forecasting",
      clearance: "internal",
      tier: "standard",
      preferredModel: "minicpm5-1b",
    },
    {
      name: "LogisticsOpt-Agent",
      type: "copilot",
      departmentName: "Supply Chain",
      taskType: "route_optimization",
      clearance: "internal",
      tier: "background",
      preferredModel: "minicpm5-1b",
    },
    // R&D — internal, experimental
    {
      name: "ResearchAssist-Agent",
      type: "pi",
      departmentName: "Research & Development",
      taskType: "research_synthesis",
      clearance: "internal",
      tier: "standard",
      preferredModel: "qwen3.5",
    },
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
      key: "org_admin",
      label: "Org Admin",
      description:
        "Full org-tree authority: create, rename, reparent, delete any node. Typically the Tenant admin / VP-Operations.",
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
      key: "plant_manager",
      label: "Plant Manager",
      description:
        "Rename own plant; create + rename lines/teams within own plant. Cannot re-parent or delete.",
      scopeType: "plant",
      permissions: ["org_node:create", "org_node:rename"],
    },
    {
      key: "dept_head",
      label: "Department Head",
      description:
        "Rename own department; view-only elsewhere. Adept for VP/Director escalated to dept-head scope.",
      scopeType: "department",
      permissions: ["org_node:rename"],
    },
    {
      key: "viewer",
      label: "Viewer",
      description: "Read-only access to dashboards. No org-tree edits.",
      scopeType: "department",
      permissions: [],
    },
  ],

  // ── Work-type taxonomies (D7) — per-department/per-plant label sets ──
  workTypeTaxonomies: [
    {
      departmentName: "Engineering",
      labels: [
        "code_review",
        "code_generation",
        "test_generation",
        "architecture_design",
        "hot_issue_resolution",
        "devops_automation",
        "dependency_upgrade",
        "documentation",
      ],
    },
    {
      departmentName: "Production",
      labels: [
        "cnc_toolpath_optimization",
        "defect_analysis",
        "process_recipe_optimization",
        "predictive_maintenance",
        "line_balance_analysis",
        "spc_analysis",
        "cad_geometry_review",
        "quality_inspection",
      ],
      secondaryTagPresets: ["resource:mes", "resource:scada", "resource:plm"],
    },
    {
      departmentName: "Quality Control",
      labels: [
        "test_generation",
        "defect_analysis",
        "cybersecurity_scan",
        "compliance_review",
        "spc_analysis",
      ],
    },
    {
      departmentName: "Procurement & Supply Chain",
      labels: [
        "demand_forecasting",
        "route_optimization",
        "inventory_replenishment",
        "supplier_evaluation",
        "logistics_planning",
      ],
    },
    {
      departmentName: "Research & Development",
      labels: ["research_synthesis", "experiment_design", "patent_analysis", "material_research"],
    },
    {
      departmentName: "Maintenance",
      labels: [
        "cybersecurity_scan",
        "predictive_maintenance",
        "compliance_review",
        "hot_issue_resolution",
      ],
    },
  ],

  // ── Work packages (D9) — 20-package manufacturing set ───────────────────
  // (docs/solutions/2026-08-13-work-package-roadmap.md §6, seeded from OEM research;
  //  10 new automotive OEM toolchain packages added per the Aug 2026 landscape survey)
  workPackages: [
    {
      roleKey: "quality_engineer",
      name: "Quality Engineer",
      family: "quality",
      mode: "copilot",
      description:
        "SPC/CMM analysis, defect triage, and 8D/control-plan/PPAP documentation for plant quality engineers.",
      tools: [
        { tool: "spc.cmm-connector", toolVersion: "2.1.0" },
        { tool: "mes.defect-feed", toolVersion: "1.4.0" },
        { tool: "ticketing.jira", toolVersion: "3.0.0" },
      ],
      skills: ["8d-report", "control-plan-editor", "ppap-checklist"],
      subagentConfigs: ["8d-drafter", "spc-monitor"],
      permissions: [
        "resource:mes:read",
        "tool:spc.cmm-connector:invoke",
        "tool:mes.defect-feed:invoke",
        "tool:ticketing.jira:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 600, critical_reserve_pct: 10 },
      starterPrompts: [
        "Draft an 8D for defect #4821: seal leak on line 3",
        "Generate a control plan for a new stamping process",
        "Summarize today's defect feed and list the three most urgent issues",
        "Check this week's CMM measurements and flag any dimension trending out of tolerance",
      ],
      templateRefs: ["tpl.8d-report", "tpl.control-plan", "tpl.ppap-checklist"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["product_quality_engineer_pqe", "spc_metrology_engineer"],
    },
    {
      roleKey: "sqe_supplier_quality",
      name: "Supplier Quality Engineer",
      family: "quality",
      mode: "copilot",
      description:
        "Supplier PPAP tracking, VDA 6.3 audits, SCAR/8D follow-ups, and chargeback calculation.",
      tools: [
        { tool: "supplier.portal", toolVersion: "1.2.0" },
        { tool: "ppap.inbox", toolVersion: "1.0.0" },
        { tool: "ticketing.jira", toolVersion: "3.0.0" },
      ],
      skills: ["vda63-audit", "scar-8d", "chargeback-calc"],
      subagentConfigs: [],
      permissions: [
        "tool:supplier.portal:invoke",
        "tool:ppap.inbox:invoke",
        "tool:ticketing.jira:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 800, critical_reserve_pct: 10 },
      starterPrompts: [
        "Send a supplier request for the late PPAP on part 902-B and track the reply",
        "Run a VDA 6.3 audit checklist for supplier Acme Tooling",
        "Draft a SCAR for the repeat defect on incoming fasteners and copy the buyer",
        "Calculate what we can charge back to supplier InnoGear for last month's line stops",
      ],
      templateRefs: ["tpl.vda63-audit", "tpl.scar-8d", "tpl.chargeback"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["supplier_quality_engineer_sqe"],
    },
    {
      roleKey: "plc_programmer",
      name: "PLC Programmer",
      family: "controls_engineering",
      mode: "copilot",
      description:
        "Ladder/ST code generation, OPC UA diagnostics, IO table review, and alarm templates for controls engineers.",
      tools: [
        { tool: "opcua.diagnostics", toolVersion: "1.8.0" },
        { tool: "code.repo", toolVersion: "2.0.0" },
        { tool: "io.table", toolVersion: "1.1.0" },
      ],
      skills: ["ladder-st-codegen", "aoi-library", "alarm-templates"],
      subagentConfigs: ["codegen-reviewer", "diff-merger"],
      permissions: [
        "tool:opcua.diagnostics:invoke",
        "tool:code.repo:invoke",
        "tool:io.table:invoke",
        "resource:scada:read",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "qwen3.5"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 500, critical_reserve_pct: 10 },
      starterPrompts: [
        "Generate a ladder logic routine that stops the conveyor if the e-stop is pressed",
        "Compare the new AOI with the old one and summarize what changed",
        "Draft an alarm template for the filling station and explain each severity level",
        "Read the IO table for line 2 and list any unused addresses",
      ],
      templateRefs: ["tpl.ladder-routine", "tpl.aoi", "tpl.alarm-list"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["controls_engineer_plc_programmer"],
    },
    {
      roleKey: "maintenance_technician",
      name: "Maintenance Technician",
      family: "maintenance",
      mode: "copilot",
      description:
        "Fault-to-fix playbooks, CMMS work orders, spares lookup, and escalation trees. Automated-capable for routine fault loops.",
      tools: [
        { tool: "cmms.sap-pm", toolVersion: "2.3.0" },
        { tool: "fault.kb", toolVersion: "1.5.0" },
        { tool: "spares.catalog", toolVersion: "1.0.0" },
      ],
      skills: ["fault-to-fix", "sop-checklist", "escalation-tree"],
      subagentConfigs: [],
      permissions: [
        "tool:cmms.sap-pm:invoke",
        "tool:fault.kb:invoke",
        "tool:spares.catalog:invoke",
        "resource:cmms:read",
      ],
      modelRouting: {
        allowed_models: ["minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 150, critical_reserve_pct: 10 },
      starterPrompts: [
        "Bearing temperature spiked on line 3 — walk me through the fix steps",
        "Open a work order in SAP PM for the leak on the filler valve",
        "List the spare parts needed for the conveyor gearbox and check stock",
        "Show me the checklist for a monthly robot cell inspection",
      ],
      templateRefs: ["tpl.fault-to-fix", "tpl.sop-checklist", "tpl.work-order"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["maintenance_technician_mech_elec"],
    },
    {
      roleKey: "material_planner",
      name: "Material Planner",
      family: "supply_chain",
      mode: "automated",
      description:
        "MRP exception triage, ECN impact alerts, and end-of-life stock calculation. Runs unattended on small-model batch routing.",
      tools: [
        { tool: "mrp.erp", toolVersion: "2.2.0" },
        { tool: "supplier.edi", toolVersion: "1.3.0" },
      ],
      skills: ["exception-triage", "ecn-impact", "eol-calc"],
      subagentConfigs: [],
      permissions: ["tool:mrp.erp:invoke", "tool:supplier.edi:invoke", "resource:erp:read"],
      modelRouting: {
        allowed_models: ["minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Review today's MRP exceptions and tell me which ones I must act on",
        "Check how the new engineering change affects our inventory of part 447-X",
        "Calculate end-of-life stock for the motor being discontinued in December",
      ],
      templateRefs: ["tpl.exception-triage", "tpl.ecn-impact", "tpl.eol-calc"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["material_planner_mrp"],
    },
    {
      roleKey: "production_supervisor",
      name: "Production Supervisor",
      family: "production",
      mode: "copilot",
      description:
        "Andon monitoring, shift-report generation, handover templates, and staffing models for shift supervisors.",
      tools: [
        { tool: "mes.andon", toolVersion: "1.6.0" },
        { tool: "cmms.sap-pm", toolVersion: "2.3.0" },
      ],
      skills: ["shift-report", "handover", "staffing-model"],
      subagentConfigs: [],
      permissions: ["tool:mes.andon:invoke", "tool:cmms.sap-pm:invoke", "resource:mes:read"],
      modelRouting: {
        allowed_models: ["minicpm5-1b", "claude-sonnet"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 250, critical_reserve_pct: 10 },
      starterPrompts: [
        "Draft my shift report from today's andon stops and production counts",
        "Summarize what the night shift left for me and list open issues",
        "Build a staffing model for line B over the holiday week",
      ],
      templateRefs: ["tpl.shift-report", "tpl.handover", "tpl.staffing-model"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["shift_supervisor_team_leader"],
    },
    {
      roleKey: "warranty_analyst",
      name: "Warranty Analyst",
      family: "warranty",
      mode: "copilot",
      description:
        "Warranty claim analytics, Pareto early-warning, chargeback bundles, and reserve memos for the warranty team.",
      tools: [
        { tool: "warranty.dwh", toolVersion: "1.1.0" },
        { tool: "claims.api", toolVersion: "1.0.0" },
      ],
      skills: ["pareto-early-warning", "chargeback-bundle", "reserve-memo"],
      subagentConfigs: [],
      permissions: ["tool:warranty.dwh:invoke", "tool:claims.api:invoke"],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 700, critical_reserve_pct: 10 },
      starterPrompts: [
        "Show me the top five warranty claim drivers from the last quarter",
        "Draft a chargeback bundle for supplier DeltaSeals for failed gaskets",
        "Prepare a warranty reserve memo for the Q3 finance review",
      ],
      templateRefs: ["tpl.pareto-report", "tpl.chargeback-bundle", "tpl.reserve-memo"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["warranty_field_quality_analyst", "warranty_administrator_analyst"],
    },
    {
      roleKey: "data_analyst_plant",
      name: "Plant Data Analyst",
      family: "data",
      mode: "copilot",
      description:
        "Historian (PI) queries, lakehouse SQL, SPC/downtime notebooks, OEE calculation, and dashboard building for plant analysts.",
      tools: [
        { tool: "historian.pi", toolVersion: "2.4.0" },
        { tool: "lakehouse.sql", toolVersion: "1.2.0" },
        { tool: "bi.dashboards", toolVersion: "1.7.0" },
      ],
      skills: ["spc-downtime-notebooks", "oee-calc", "dashboard-builder"],
      subagentConfigs: [],
      permissions: [
        "tool:historian.pi:invoke",
        "tool:lakehouse.sql:invoke",
        "tool:bi.dashboards:invoke",
        "resource:historian:read",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Pull downtime data for line 1 from the historian and show me the worst hours",
        "Calculate OEE for all three lines this week and explain the gaps",
        "Build a dashboard with scrap trends by shift for the plant manager",
      ],
      templateRefs: ["tpl.spc-notebook", "tpl.oee-calc", "tpl.dashboard"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["manufacturing_data_scientist", "oee_performance_analytics_engineer"],
    },
    {
      roleKey: "office_worker_general",
      name: "Office Worker (General)",
      family: "office",
      mode: "copilot",
      description:
        "SharePoint documents, email, and web search for every office employee — the volume default on the cheapest viable routing.",
      tools: [
        { tool: "sharepoint.docs", toolVersion: "1.5.0" },
        { tool: "email.outlook", toolVersion: "1.0.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
      ],
      skills: ["meeting-notes", "doc-summarize", "mail-triage"],
      subagentConfigs: [],
      permissions: [
        "tool:sharepoint.docs:invoke",
        "tool:email.outlook:invoke",
        "tool:web.search:invoke",
        "resource:sharepoint:read",
      ],
      modelRouting: {
        allowed_models: ["minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 100, critical_reserve_pct: 10 },
      starterPrompts: [
        "Summarize the three emails I got from our supplier today and list what I need to do",
        "Turn my meeting notes into a list of actions with owners and due dates",
        "Find last quarter's pricing deck on SharePoint and summarize the key numbers",
        "Search the web for the new packaging regulation and explain what changes for us",
      ],
      templateRefs: ["tpl.meeting-notes", "tpl.doc-summary", "tpl.mail-triage"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["general_office_staff"],
    },
    {
      roleKey: "exec_assistant",
      name: "Executive Assistant",
      family: "executive",
      mode: "copilot",
      description:
        "KPI briefings, approvals inbox summaries, and CRM-driven exec digests. Aggregates-only — never raw content.",
      tools: [
        { tool: "dashboards.api", toolVersion: "1.9.0" },
        { tool: "approvals.inbox", toolVersion: "1.2.0" },
        { tool: "crm.salesforce", toolVersion: "2.0.0" },
      ],
      skills: ["kpi-briefing", "exec-digest", "approval-summary"],
      subagentConfigs: [],
      permissions: [
        "tool:dashboards.api:invoke",
        "tool:approvals.inbox:invoke",
        "tool:crm.salesforce:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 200, critical_reserve_pct: 10 },
      starterPrompts: [
        "Give me a one-page briefing on this week's plant KPIs",
        "Summarize the approvals waiting in my inbox and recommend which to review first",
        "Pull the latest pipeline numbers from Salesforce for the board meeting",
        "Draft my monthly exec digest for the leadership team",
      ],
      templateRefs: ["tpl.kpi-briefing", "tpl.exec-digest", "tpl.approval-summary"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["executive_assistant"],
    },
    {
      roleKey: "senior_manager",
      name: "Senior Manager",
      family: "leadership",
      mode: "copilot",
      description:
        "Team ARM-adoption visibility, budget/spend oversight, and one-tap approvals for plant/department leads — the decision-maker persona, not a hands-on tool user.",
      tools: [
        { tool: "bi.dashboards", toolVersion: "1.4.0" },
        { tool: "approvals.inbox", toolVersion: "1.2.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
      ],
      skills: ["kpi-briefing", "exec-digest", "approval-summary"],
      subagentConfigs: [],
      permissions: [
        "tool:bi.dashboards:invoke",
        "tool:approvals.inbox:invoke",
        "tool:web.search:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Show me my team's ARM adoption funnel and where people are stalling",
        "What's waiting in my approvals inbox, ranked by urgency?",
        "Summarize this month's spend against budget for my department",
        "Draft a one-page rollout update for my leadership",
      ],
      templateRefs: ["tpl.kpi-briefing", "tpl.exec-digest", "tpl.approval-summary"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["senior_manager"],
    },
    {
      roleKey: "design_release_engineer",
      name: "Design Release Engineer (PD-DRE)",
      family: "product_engineering",
      mode: "copilot",
      description:
        "PLM change tracking, PPAP status, and release-readiness digests for the engineer who owns a component's design release — the engineering product-manager persona.",
      tools: [
        { tool: "plm.teamcenter", toolVersion: "1.8.0" },
        { tool: "plm.windchill", toolVersion: "1.6.0" },
        { tool: "ppap.inbox", toolVersion: "1.0.0" },
        { tool: "bi.dashboards", toolVersion: "1.4.0" },
      ],
      skills: ["release-readiness", "ecn-impact-summary", "ppap-status"],
      subagentConfigs: [],
      permissions: [
        "tool:plm.teamcenter:invoke",
        "tool:plm.windchill:invoke",
        "tool:ppap.inbox:invoke",
        "tool:bi.dashboards:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 350, critical_reserve_pct: 10 },
      starterPrompts: [
        "What's the release-readiness status of my components this week?",
        "Summarize the ECNs affecting my BOM and what changed",
        "Pull the open PPAP items waiting on me and rank by due date",
        "Draft the design-release summary for this week's program review",
      ],
      templateRefs: ["tpl.release-readiness", "tpl.ecn-impact", "tpl.ppap-status"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["design_release_engineer"],
    },
    {
      roleKey: "cae_analyst",
      name: "CAE Analyst",
      family: "simulation",
      mode: "copilot",
      description:
        "Pre-processing, solver runs, and post-reporting for crash/NVH/aero simulation, plus test correlation.",
      tools: [
        { tool: "sim.ansa", toolVersion: "1.2.0" },
        { tool: "sim.gt-suite", toolVersion: "1.1.0" },
        { tool: "sim.star-ccm", toolVersion: "1.5.0" },
        { tool: "plm.teamcenter", toolVersion: "2.0.0" },
      ],
      skills: ["mesh-and-run", "post-report", "test-correlation"],
      subagentConfigs: [],
      permissions: [
        "tool:sim.ansa:invoke",
        "tool:sim.gt-suite:invoke",
        "tool:sim.star-ccm:invoke",
        "tool:plm.teamcenter:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Prepare an LS-DYNA crash deck for NCAP front impact",
        "Summarize 50 solver runs into a correlation report",
        "Check this BIW mesh quality against our standards",
      ],
      templateRefs: ["tpl.solver-run-report", "tpl.mesh-check", "tpl.correlation-report"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["fea_structural_analyst", "durability_fatigue_analyst"],
    },
    {
      roleKey: "embedded_sw_engineer",
      name: "Embedded Software Engineer",
      family: "embedded_software",
      mode: "copilot",
      description:
        "AUTOSAR model development, MISRA fixes, and MIL/SIL testing for embedded software engineers.",
      tools: [
        { tool: "mdl.matlab-simulink", toolVersion: "2.1.0" },
        { tool: "autosar.tresos", toolVersion: "1.2.0" },
        { tool: "autosar.davinci", toolVersion: "1.1.0" },
        { tool: "test.canoe", toolVersion: "1.9.0" },
      ],
      skills: ["autosar-codegen", "misra-fix", "mil-sil-test"],
      subagentConfigs: [],
      permissions: [
        "tool:mdl.matlab-simulink:invoke",
        "tool:autosar.tresos:invoke",
        "tool:autosar.davinci:invoke",
        "tool:test.canoe:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Generate the Simulink state machine for traction-motor control",
        "Fix MISRA violations in this AUTOSAR module",
        "Build a MIL test suite for the BMS logic",
      ],
      templateRefs: ["tpl.autosar-module", "tpl.misra-fix", "tpl.mil-sil-suite"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["embedded_software_engineer"],
    },
    {
      roleKey: "systems_engineer",
      name: "Systems Engineer",
      family: "systems_engineering",
      mode: "copilot",
      description:
        "Requirements flowdown, traceability matrices, and FMEA guidance for systems engineers.",
      tools: [
        { tool: "rm.jama", toolVersion: "1.3.0" },
        { tool: "rm.polarion", toolVersion: "1.2.0" },
        { tool: "rm.codebeamer", toolVersion: "1.1.0" },
        { tool: "ee.preevision", toolVersion: "1.6.0" },
      ],
      skills: ["requirements-flowdown", "traceability-matrix", "fmea-guide"],
      subagentConfigs: [],
      permissions: [
        "tool:rm.jama:invoke",
        "tool:rm.polarion:invoke",
        "tool:rm.codebeamer:invoke",
        "tool:ee.preevision:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 350, critical_reserve_pct: 10 },
      starterPrompts: [
        "Decompose this feature requirement into system + component requirements",
        "Generate a traceability matrix for ISO 26262 item XYZ",
        "Draft the system FMEA for the brake-by-wire system",
      ],
      templateRefs: ["tpl.requirements-flowdown", "tpl.traceability-matrix", "tpl.fmea-guide"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["systems_engineer"],
    },
    {
      roleKey: "calibration_engineer",
      name: "Calibration Engineer",
      family: "calibration",
      mode: "copilot",
      description:
        "Dataset releases, drive-cycle analysis, and DoE for powertrain calibration engineers.",
      tools: [
        { tool: "cal.inca", toolVersion: "1.6.0" },
        { tool: "test.dspace", toolVersion: "1.2.0" },
        { tool: "mdl.matlab-simulink", toolVersion: "2.1.0" },
      ],
      skills: ["dataset-release", "drive-cycle-analysis", "doee"],
      subagentConfigs: [],
      permissions: [
        "tool:cal.inca:invoke",
        "tool:test.dspace:invoke",
        "tool:mdl.matlab-simulink:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 350, critical_reserve_pct: 10 },
      starterPrompts: [
        "Analyze yesterday's road data for drivability outliers",
        "Prepare the dataset release notes for build 14.2",
        "Compare WLTP cycles across 3 calibration variants",
      ],
      templateRefs: ["tpl.dataset-release", "tpl.drive-cycle-analysis", "tpl.doe-plan"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["powertrain_calibration_engineer"],
    },
    {
      roleKey: "hils_engineer",
      name: "HILS Engineer",
      family: "validation",
      mode: "copilot",
      description:
        "Fault injection, HIL automation, and bus analysis for hardware-in-the-loop test engineers.",
      tools: [
        { tool: "test.dspace", toolVersion: "1.2.0" },
        { tool: "test.canoe", toolVersion: "1.9.0" },
      ],
      skills: ["fault-injection", "hil-automation", "bus-analysis"],
      subagentConfigs: [],
      permissions: ["tool:test.dspace:invoke", "tool:test.canoe:invoke"],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Design a fault-injection matrix for the e-motor inverter",
        "Generate a HIL test report from these CAN logs",
        "Automate this SCALEXIO regression suite",
      ],
      templateRefs: ["tpl.fault-injection-matrix", "tpl.hil-test-report", "tpl.can-log-analysis"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["hil_test_engineer"],
    },
    {
      roleKey: "program_manager",
      name: "Program Manager",
      family: "program_management",
      mode: "copilot",
      description: "APQP timing, program status decks, and issue triage for program managers.",
      tools: [
        { tool: "pm.cplace", toolVersion: "1.4.0" },
        { tool: "docs.confluence", toolVersion: "2.2.0" },
        { tool: "ticketing.jira", toolVersion: "3.0.0" },
      ],
      skills: ["apqp-timing", "status-deck", "issue-triage"],
      subagentConfigs: [],
      permissions: [
        "tool:pm.cplace:invoke",
        "tool:docs.confluence:invoke",
        "tool:ticketing.jira:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 250, critical_reserve_pct: 10 },
      starterPrompts: [
        "Summarize the open-issues list for tomorrow's program review",
        "Draft the APQP gate review deck for project Pegasus",
        "Which milestones are at risk this week?",
      ],
      templateRefs: ["tpl.apqp-timing", "tpl.status-deck", "tpl.issue-triage"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["launch_program_manager_apqp"],
    },
    {
      roleKey: "plm_administrator",
      name: "PLM Administrator",
      family: "plm",
      mode: "copilot",
      description: "ECN workflows, BOM reconciliation, and part numbering for PLM administrators.",
      tools: [
        { tool: "plm.teamcenter", toolVersion: "2.0.0" },
        { tool: "plm.windchill", toolVersion: "1.8.0" },
      ],
      skills: ["ecn-workflow", "bom-reconcile", "part-numbering"],
      subagentConfigs: [],
      permissions: ["tool:plm.teamcenter:invoke", "tool:plm.windchill:invoke"],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 250, critical_reserve_pct: 10 },
      starterPrompts: [
        "Reconcile the EBOM vs MBOM drift for part family B7",
        "Draft the ECN impact note for drawing 4471 rev C",
        "Find duplicate part numbers in the fastener library",
      ],
      templateRefs: ["tpl.ecn-workflow", "tpl.bom-reconcile", "tpl.part-number"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["plm_administrator"],
    },
    {
      roleKey: "mfg_sim_engineer",
      name: "Manufacturing Simulation Engineer",
      family: "manufacturing_engineering",
      mode: "copilot",
      description:
        "Robot OLFP validation, virtual commissioning, and line-balance analysis for manufacturing simulation engineers.",
      tools: [
        { tool: "mfg.tecnomatix", toolVersion: "1.7.0" },
        { tool: "mfg.delmia", toolVersion: "1.5.0" },
        { tool: "dt.omniverse", toolVersion: "1.0.0" },
      ],
      skills: ["robot-olfp", "virtual-commissioning", "line-balance"],
      subagentConfigs: [],
      permissions: [
        "tool:mfg.tecnomatix:invoke",
        "tool:mfg.delmia:invoke",
        "tool:dt.omniverse:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 350, critical_reserve_pct: 10 },
      starterPrompts: [
        "Validate reachability of the new weld cell layout",
        "Generate a virtual commissioning plan for line 2",
        "Compare cycle times: 3 layout scenarios",
      ],
      templateRefs: ["tpl.robot-olfp", "tpl.virtual-commissioning", "tpl.line-balance"],
      minAgentVersion: "1.0.0",
      jobFunctions: [
        "factory_simulation_engineer",
        "throughput_discrete_event_simulation_engineer",
      ],
    },
    {
      roleKey: "ee_architect",
      name: "EE Architect",
      family: "electrical_architecture",
      mode: "copilot",
      description: "Harness design, topology planning, and signal-database work for EE architects.",
      tools: [
        { tool: "ee.capital", toolVersion: "1.5.0" },
        { tool: "ee.e3-series", toolVersion: "1.3.0" },
        { tool: "ee.preevision", toolVersion: "1.6.0" },
      ],
      skills: ["harness-design", "topology-design", "signal-db"],
      subagentConfigs: [],
      permissions: [
        "tool:ee.capital:invoke",
        "tool:ee.e3-series:invoke",
        "tool:ee.preevision:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Design the zonal architecture for the next-gen platform",
        "Generate the signal database delta between platform A and B",
        "Check harness routing against the packaging model",
      ],
      templateRefs: ["tpl.harness-design", "tpl.topology-design", "tpl.signal-db"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["e_e_architecture_engineer"],
    },
    {
      roleKey: "qms_apqp",
      name: "QMS / APQP Coordinator",
      family: "quality_systems",
      mode: "copilot",
      description:
        "FMEA-to-control-plan linkage, PPAP/PSW packages, and SPC capability studies for the quality systems team.",
      tools: [
        { tool: "qms.aqua-pro", toolVersion: "1.2.0" },
        { tool: "qms.net-inspect", toolVersion: "1.1.0" },
        { tool: "spc.minitab", toolVersion: "1.3.0" },
        { tool: "qms.sap-qm", toolVersion: "1.4.0" },
      ],
      skills: ["fmea-control-plan", "ppap-psw", "spc-capability"],
      subagentConfigs: [],
      permissions: [
        "tool:qms.aqua-pro:invoke",
        "tool:qms.net-inspect:invoke",
        "tool:spc.minitab:invoke",
        "tool:qms.sap-qm:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Link the PFMEA to the control plan for process P3",
        "Prepare the PPAP/PSW package for supplier S-142",
        "Run capability study on hole diameter Cpk data",
      ],
      templateRefs: ["tpl.fmea-control-plan", "tpl.ppap-psw", "tpl.spc-capability"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["launch_program_manager_apqp", "quality_auditor_system_process_product"],
    },
  ],

  // ── Job-function taxonomy (D10) ──────────────────────────────────────────
  jobFunctions: MANUFACTURING_JOB_FUNCTIONS,
};
