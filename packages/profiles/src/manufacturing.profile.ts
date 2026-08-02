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

  // ── Org-tree: deep (Plant → Line/Cell → Station + shift dimension) ───────
  orgTree: {
    style: "deep",
    description:
      "Deep hierarchy: Organization → Plant → Line/Cell → Station, plus a shift dimension for scheduling and stakeholder routing.",
    defaultDepartments: [
      { name: "Engineering", budgetMonthlyCents: 8000_00 },
      { name: "Manufacturing", budgetMonthlyCents: 6000_00 },
      { name: "Quality Assurance", budgetMonthlyCents: 4000_00 },
      { name: "Supply Chain", budgetMonthlyCents: 3000_00 },
      { name: "Research & Development", budgetMonthlyCents: 5000_00 },
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
    // Manufacturing — confidential clearance, self-hosted only
    { name: "ToolPath-Optimizer", type: "opencode", departmentName: "Manufacturing", taskType: "cnc_toolpath_optimization", clearance: "confidential", tier: "critical", preferredModel: "qwen3.5" },
    { name: "QualityAnalysis-Agent", type: "claude_code", departmentName: "Manufacturing", taskType: "defect_analysis", clearance: "confidential", tier: "standard", preferredModel: "minicpm5-1b" },
    // QA — mixed clearance
    { name: "TestGen-Agent", type: "copilot", departmentName: "Quality Assurance", taskType: "test_generation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "SecurityScan-Agent", type: "claude_code", departmentName: "Quality Assurance", taskType: "security_scan", clearance: "restricted", tier: "critical", preferredModel: "qwen3.5" },
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
  ],
};
