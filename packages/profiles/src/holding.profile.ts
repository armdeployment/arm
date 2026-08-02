/**
 * Holding Company / Conglomerate Industry Profile preset (D6).
 *
 * Pure data. The key architectural difference: a holding company has MULTIPLE
 * Organizations (subsidiaries) under one Tenant. D1-b put Tenant above
 * Organization precisely so this is first-class — "one tenant, two flavors,
 * zero migration" (D6 rationale).
 *
 * Each subsidiary may have a different industry focus (one tech, one
 * manufacturing, one finance). The holding profile seeds a portfolio view
 * with cross-entity consolidation + Chinese-wall isolation between
 * subsidiaries.
 *
 * Resource types and capabilities are a SUPERSET — the holding tenant can
 * enable anything any subsidiary needs.
 */

import type { IndustryProfilePreset } from "./types";

export const holdingProfile: IndustryProfilePreset = {
  id: "holding",
  label: "Holding Company / Conglomerate",
  description:
    "Multi-subsidiary enterprise: consolidated governance across diverse businesses, cross-entity audit, Chinese-wall isolation, portfolio-level budgeting.",

  orgTree: {
    style: "deep",
    description:
      "Multi-org: Tenant → multiple Organizations (subsidiaries) → Departments. Each subsidiary may run a different industry profile. Cross-subsidiary access is isolated by default (Chinese walls).",
    // Seed subsidiaries — each becomes an Organization under the Tenant
    defaultDepartments: [
      { name: "Corporate (Parent)", budgetMonthlyCents: 5000_00 },
      { name: "Subsidiary: Tech Division", budgetMonthlyCents: 8000_00 },
      { name: "Subsidiary: Manufacturing Division", budgetMonthlyCents: 6000_00 },
      { name: "Subsidiary: Finance Division", budgetMonthlyCents: 7000_00 },
      { name: "Shared Services", budgetMonthlyCents: 3000_00 },
    ],
  },

  personas: [
    { key: "portfolio_manager", label: "Portfolio Manager", defaultPanels: ["subsidiary_overview", "consolidated_spend", "portfolio_health"] },
    { key: "subsidiary_cfo", label: "Subsidiary CFO", defaultPanels: ["spend", "agents", "consolidated_spend"] },
    { key: "consolidation_analyst", label: "Consolidation Analyst", defaultPanels: ["consolidated_spend", "cross_entity_audit"] },
    { key: "board_reporter", label: "Board Reporter", defaultPanels: ["subsidiary_overview", "portfolio_health", "cross_entity_audit"] },
    { key: "shared_services", label: "Shared Services Admin", defaultPanels: ["spend", "agents", "access", "audit"] },
    { key: "admin", label: "Group Admin", defaultPanels: ["subsidiary_overview", "consolidated_spend", "cross_entity_audit", "portfolio_health", "agents", "access", "audit", "resources", "idp"] },
  ],

  // Superset — holding company can enable anything any subsidiary needs
  resourceTypes: {
    enabled: [
      "s3", "gcs", "db", "sharepoint", "onedrive", "files", "internal",
      // OT (manufacturing subsidiary)
      "mes", "erp", "scada", "historian", "plm", "cmms", "iot",
      // Finance subsidiary
      "trading_system", "bloomberg", "reuters", "risk_engine",
    ],
  },

  classification: {
    axes: ["sensitivity", "regulatory"],
    levels: [
      { rank: 0, name: "public", regulatoryFlags: [] },
      { rank: 1, name: "internal", regulatoryFlags: [] },
      {
        rank: 2,
        name: "confidential",
        regulatoryFlags: ["SOX", "ITAR", "EAR", "GLBA"],
      },
      {
        rank: 3,
        name: "restricted",
        // Cross-subsidiary content carries the strictest regulatory set
        regulatoryFlags: ["SOX", "ITAR", "EAR", "GLBA", "PCI-DSS", "GxP"],
      },
    ],
  },

  dlpPatterns: [
    // ── Universal ──
    {
      name: "SSN",
      pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      severity: "critical",
      category: "pii",
    },
    {
      name: "Credit Card",
      pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      severity: "warning",
      category: "financial",
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
    // ── Manufacturing subsidiary ──
    {
      name: "Export-Controlled (ITAR/EAR)",
      pattern: "\\b(ITAR|EAR|export.?controlled|DDTC)\\b",
      flags: "i",
      severity: "critical",
      category: "export_controlled",
    },
    {
      name: "Process Recipe / BOM",
      pattern: "\\b(recipe|bill.?of.?materials|BOM)\\b.*[:=]\\s*\\S+",
      flags: "i",
      severity: "critical",
      category: "proprietary",
    },
    // ── Finance subsidiary ──
    {
      name: "SWIFT/BIC Code",
      pattern: "\\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\\b",
      severity: "critical",
      category: "financial",
    },
    {
      name: "Insider / MNPI",
      pattern: "\\b(MNPI|insider|material.?non.?public|pre.?announcement)\\b",
      flags: "i",
      severity: "critical",
      category: "export_controlled",
    },
    // ── Cross-entity (holding-specific) ──
    {
      name: "Cross-Entity M&A Reference",
      pattern: "\\b(acquisition|merger|MA|divestiture|spin.?off)\\b.*[:=]?\\s*\\$?\\d",
      flags: "i",
      severity: "critical",
      category: "proprietary",
    },
    {
      name: "Subsidiary Financial (Pre-Earnings)",
      pattern: "\\b(earnings|revenue|EBITDA|pre.?tax)\\b.*[:=]?\\s*\\$?\\d{4,}",
      flags: "i",
      severity: "critical",
      category: "financial",
    },
  ],

  tierLabels: {
    critical: "Cross-entity governance / regulatory agent",
    standard: "Subsidiary operations agent",
    background: "Consolidation / batch reporting",
  },

  budgetPeriods: ["monthly", "quarterly"],

  modelRouting: {
    strategy: "edge-onprep-first",
    description:
      "On-prem first for restricted/cross-entity content. Subsidiaries may use cloud models for public/internal workloads.",
  },

  connectivity: {
    assumption: "cloud-native",
    offlinePolicyTtl: false,
  },

  stakeholderRouting: {
    mode: "single-human",
    description:
      "Per-subsidiary accountable human + group-level compliance oversight on cross-entity alerts.",
  },

  seedAgents: [
    // Corporate (Parent)
    { name: "Consolidation-Agent", type: "claude_code", departmentName: "Corporate (Parent)", taskType: "financial_consolidation", clearance: "restricted", tier: "critical", preferredModel: "qwen3.5" },
    { name: "BoardReport-Agent", type: "opencode", departmentName: "Corporate (Parent)", taskType: "board_reporting", clearance: "confidential", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "MACounsel-Agent", type: "claude_code", departmentName: "Corporate (Parent)", taskType: "ma_legal_review", clearance: "restricted", tier: "critical", preferredModel: "qwen3.5" },
    // Tech Division
    { name: "CodeReview-Bot", type: "claude_code", departmentName: "Subsidiary: Tech Division", taskType: "code_review", clearance: "internal", tier: "standard", preferredModel: "qwen3.5" },
    { name: "DevOps-Agent", type: "copilot", departmentName: "Subsidiary: Tech Division", taskType: "devops_automation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    // Manufacturing Division
    { name: "ToolPath-Optimizer", type: "opencode", departmentName: "Subsidiary: Manufacturing Division", taskType: "cnc_toolpath_optimization", clearance: "confidential", tier: "critical", preferredModel: "qwen3.5" },
    { name: "QualityAnalysis-Agent", type: "claude_code", departmentName: "Subsidiary: Manufacturing Division", taskType: "defect_analysis", clearance: "confidential", tier: "standard", preferredModel: "minicpm5-1b" },
    // Finance Division
    { name: "RiskAssess-Agent", type: "claude_code", departmentName: "Subsidiary: Finance Division", taskType: "risk_assessment", clearance: "restricted", tier: "critical", preferredModel: "qwen3.5" },
    { name: "ComplianceCheck-Bot", type: "opencode", departmentName: "Subsidiary: Finance Division", taskType: "compliance_review", clearance: "confidential", tier: "critical", preferredModel: "qwen3.5" },
    // Shared Services
    { name: "ITGovernance-Agent", type: "pi", departmentName: "Shared Services", taskType: "it_governance", clearance: "internal", tier: "standard", preferredModel: "qwen3.5" },
    { name: "AuditTrail-Agent", type: "claude_code", departmentName: "Shared Services", taskType: "audit_trail_analysis", clearance: "restricted", tier: "standard", preferredModel: "qwen3.5" },
  ],

  uiPanels: [
    { key: "subsidiary_overview", label: "Subsidiary Overview", order: 0 },
    { key: "consolidated_spend", label: "Consolidated Spend", order: 1 },
    { key: "portfolio_health", label: "Portfolio Health", order: 2 },
    { key: "cross_entity_audit", label: "Cross-Entity Audit", order: 3 },
    { key: "spend", label: "Spend Overview", order: 4 },
    { key: "agents", label: "Agent Fleet", order: 5 },
    { key: "access", label: "Access Control", order: 6 },
    { key: "audit", label: "Audit Trail", order: 7 },
    { key: "resources", label: "Resources", order: 8 },
    { key: "idp", label: "Identity Providers", order: 9 },
  ],
};
