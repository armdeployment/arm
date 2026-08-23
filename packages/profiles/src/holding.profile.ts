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

import type { IndustryProfilePreset } from "./types.js";
import { HOLDING_JOB_FUNCTIONS } from "./job-taxonomy.holding.js";

export const holdingProfile: IndustryProfilePreset = {
  id: "holding",
  label: "Holding Company / Conglomerate",
  description:
    "Multi-subsidiary enterprise: consolidated governance across diverse businesses, cross-entity audit, Chinese-wall isolation, portfolio-level budgeting.",

  orgTree: {
    style: "deep",
    description:
      "Multi-org: Tenant → multiple Organizations (subsidiaries) → Departments/Plants. Each subsidiary runs a different industry profile. Cross-subsidiary access is isolated by default (Chinese walls).",
    nodes: [
      // ── Parent / Corporate ──
      {
        type: "organization",
        name: "Corporate (Parent)",
        budgetMonthlyCents: 5000_00,
        children: [
          { type: "department", name: "M&A / Legal", budgetMonthlyCents: 1500_00 },
          { type: "department", name: "Treasury", budgetMonthlyCents: 1000_00 },
          { type: "department", name: "Investor Relations", budgetMonthlyCents: 800_00 },
          { type: "department", name: "Shared IT Services", budgetMonthlyCents: 1700_00 },
        ],
      },
      // ── Subsidiary: Tech Division ──
      {
        type: "organization",
        name: "Subsidiary: Tech Division",
        budgetMonthlyCents: 8000_00,
        children: [
          { type: "department", name: "Engineering", budgetMonthlyCents: 5000_00 },
          { type: "department", name: "Product", budgetMonthlyCents: 2000_00 },
          { type: "department", name: "DevOps", budgetMonthlyCents: 1000_00 },
        ],
      },
      // ── Subsidiary: Manufacturing Division (with plants!) ──
      {
        type: "organization",
        name: "Subsidiary: Manufacturing Division",
        budgetMonthlyCents: 10000_00,
        children: [
          {
            type: "plant", name: "Plant Detroit", location: "Detroit, MI, USA",
            budgetMonthlyCents: 5000_00, tags: { regulatory: "ITAR" },
            children: [
              { type: "department", name: "Production", budgetMonthlyCents: 3000_00 },
              { type: "department", name: "Quality Control", budgetMonthlyCents: 1000_00 },
              { type: "department", name: "Maintenance", budgetMonthlyCents: 1000_00 },
            ],
          },
          {
            type: "plant", name: "Plant Shenzhen", location: "Shenzhen, China",
            budgetMonthlyCents: 5000_00,
            children: [
              { type: "department", name: "Production", budgetMonthlyCents: 3000_00 },
              { type: "department", name: "Quality Control", budgetMonthlyCents: 1000_00 },
              { type: "department", name: "Logistics", budgetMonthlyCents: 1000_00 },
            ],
          },
        ],
      },
      // ── Subsidiary: Finance Division ──
      {
        type: "organization",
        name: "Subsidiary: Finance Division",
        budgetMonthlyCents: 7000_00,
        children: [
          { type: "department", name: "Trading", budgetMonthlyCents: 3000_00 },
          { type: "department", name: "Risk Management", budgetMonthlyCents: 2000_00 },
          { type: "department", name: "Compliance", budgetMonthlyCents: 2000_00 },
        ],
      },
    ],
    // Legacy flat list
    defaultDepartments: [
      { name: "Corporate (Parent)", budgetMonthlyCents: 5000_00 },
      { name: "Subsidiary: Tech Division", budgetMonthlyCents: 8000_00 },
      { name: "Subsidiary: Manufacturing Division", budgetMonthlyCents: 10000_00 },
      { name: "Subsidiary: Finance Division", budgetMonthlyCents: 7000_00 },
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

  // ── Role presets (D8) — cross-subsidiary org authority ──
  rolePresets: [
    {
      key: "org_admin", label: "Org Admin",
      description: "Parent-company level authority: restructure any subsidiary, add new subsidiaries, reparent across the whole tree.",
      scopeType: "org", singleton: true,
      permissions: ["org_node:create", "org_node:rename", "org_node:reparent", "org_node:delete", "*"]
    },
    {
      key: "subsidiary_admin", label: "Subsidiary Admin",
      description: "Restructure WITHIN their subsidiary only: add plants, departments, lines. Cannot reparent across subsidiaries.",
      scopeType: "organization",
      permissions: ["org_node:create", "org_node:rename"]
    },
    {
      key: "portfolio_manager", label: "Portfolio Manager",
      description: "Read-only view across all subsidiaries. No org-tree edits.",
      scopeType: "org", singleton: true,
      permissions: []
    },
    {
      key: "viewer", label: "Viewer",
      description: "Read-only within their own subsidiary.",
      scopeType: "organization",
      permissions: []
    },
  ],

  // ── Work-type taxonomies (D7) — per-subsidiary label sets ──
  workTypeTaxonomies: [
    {
      departmentName: "Corporate (Parent)",
      labels: ["financial_consolidation", "board_reporting", "ma_legal_review", "treasury_analysis", "investor_relations"],
    },
    {
      departmentName: "Subsidiary: Tech Division",
      labels: ["code_review", "devops_automation", "architecture_design", "incident_triage", "dependency_upgrade"],
    },
    {
      departmentName: "Subsidiary: Manufacturing Division",
      labels: ["cnc_toolpath_optimization", "defect_analysis", "predictive_maintenance", "quality_inspection", "demand_forecasting"],
    },
    {
      departmentName: "Subsidiary: Finance Division",
      labels: ["risk_assessment", "trade_analysis", "compliance_review", "reconciliation", "regulatory_reporting"],
    },
    {
      departmentName: "Shared Services",
      labels: ["it_governance", "audit_trail_analysis", "access_review", "policy_review", "cybersecurity_scan"],
    },
  ],

  // ── Work packages (D9) — holding pilot set ───────────────────────────────
  workPackages: [
    {
      roleKey: "consolidation_analyst",
      name: "Consolidation Analyst",
      family: "corporate_finance",
      mode: "copilot",
      description: "Cross-entity consolidation, board-pack assembly, and variance memos for group finance.",
      tools: [
        { tool: "erp.sap", toolVersion: "2.0.0" },
        { tool: "spreadsheets.excel", toolVersion: "1.2.0" },
        { tool: "bi.dashboards", toolVersion: "1.7.0" },
      ],
      skills: ["consolidation-checklist", "board-pack", "variance-memo"],
      subagentConfigs: [],
      permissions: [
        "tool:erp.sap:invoke",
        "tool:spreadsheets.excel:invoke",
        "tool:bi.dashboards:invoke",
        "resource:erp:read",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 500, critical_reserve_pct: 10 },
      starterPrompts: [
        "Run the consolidation checklist for this quarter and list what is still missing",
        "Draft the variance memo explaining the manufacturing division's cost overrun",
        "Assemble the first section of the board pack from the subsidiary submissions",
      ],
      templateRefs: ["tpl.consolidation-checklist", "tpl.board-pack", "tpl.variance-memo"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["consolidation_analyst"],
    },
    {
      roleKey: "exec_assistant",
      name: "Executive Assistant",
      family: "executive",
      mode: "copilot",
      description: "Portfolio KPI briefings, approvals inbox summaries, and web research for group leadership. Aggregates-only — never raw content.",
      tools: [
        { tool: "dashboards.api", toolVersion: "1.9.0" },
        { tool: "approvals.inbox", toolVersion: "1.2.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
      ],
      skills: ["kpi-briefing", "exec-digest", "approval-summary"],
      subagentConfigs: [],
      permissions: [
        "tool:dashboards.api:invoke",
        "tool:approvals.inbox:invoke",
        "tool:web.search:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 200, critical_reserve_pct: 10 },
      starterPrompts: [
        "Give me a one-page briefing on portfolio health across all subsidiaries",
        "Summarize the approvals waiting in my inbox and recommend which to review first",
        "Draft my monthly exec digest for the group leadership team",
      ],
      templateRefs: ["tpl.kpi-briefing", "tpl.exec-digest", "tpl.approval-summary"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["executive_assistant"],
    },
  ],

  // ── Job-function taxonomy (D10) ──────────────────────────────────────────
  jobFunctions: HOLDING_JOB_FUNCTIONS,
};
