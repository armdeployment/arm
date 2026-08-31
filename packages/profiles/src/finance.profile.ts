/**
 * Finance / Financial Services Industry Profile preset (D6).
 *
 * Pure data. Key differences from tech/manufacturing:
 *   - Regulatory: SOX, GLBA, PCI-DSS, SEC, FINRA dual-axis classification
 *   - DLP: SWIFT codes, account numbers, trading algorithms, insider information
 *   - Model routing: on-prem first (data residency + regulatory compliance)
 *   - Budget periods: monthly + quarterly (regulatory reporting cycles)
 *   - Personas: trader, risk analyst, compliance officer, quant, CFO
 */

import type { IndustryProfilePreset } from "./types.js";
import { FINANCE_JOB_FUNCTIONS } from "./job-taxonomy.finance.js";

export const financeProfile: IndustryProfilePreset = {
  id: "finance",
  label: "Finance / Financial Services",
  description:
    "Bank, asset manager, or trading firm: regulatory-first (SOX/GLBA/PCI/SEC), on-prem model routing, quarterly budget cycles, Chinese-wall isolation.",

  orgTree: {
    style: "flat",
    description:
      "Flat hierarchy with strong cross-team isolation (Chinese walls). Organization → Department → Desk → Workstream.",
    nodes: [
      { type: "department", name: "Trading", budgetMonthlyCents: 12000_00 },
      { type: "department", name: "Risk Management", budgetMonthlyCents: 6000_00 },
      { type: "department", name: "Compliance", budgetMonthlyCents: 4000_00 },
      { type: "department", name: "Quantitative Research", budgetMonthlyCents: 8000_00 },
      { type: "department", name: "Operations", budgetMonthlyCents: 3000_00 },
      { type: "department", name: "Audit", budgetMonthlyCents: 2000_00 },
    ],
    defaultDepartments: [
      { name: "Trading", budgetMonthlyCents: 12000_00 },
      { name: "Risk Management", budgetMonthlyCents: 6000_00 },
      { name: "Compliance", budgetMonthlyCents: 4000_00 },
      { name: "Quantitative Research", budgetMonthlyCents: 8000_00 },
      { name: "Operations", budgetMonthlyCents: 3000_00 },
      { name: "Audit", budgetMonthlyCents: 2000_00 },
    ],
  },

  personas: [
    { key: "trader", label: "Trader", defaultPanels: ["spend", "trade_volume", "risk_exposure"] },
    {
      key: "risk_analyst",
      label: "Risk Analyst",
      defaultPanels: ["risk_exposure", "compliance_status", "spend"],
    },
    {
      key: "compliance_officer",
      label: "Compliance Officer",
      defaultPanels: ["compliance_status", "regulatory_deadlines", "audit"],
    },
    {
      key: "quant",
      label: "Quant Researcher",
      defaultPanels: ["spend", "trade_volume", "model_policy"],
    },
    {
      key: "audit",
      label: "Internal Audit",
      defaultPanels: ["audit", "compliance_status", "access"],
    },
    {
      key: "cfo",
      label: "CFO / Finance",
      defaultPanels: ["spend", "consolidated_spend", "risk_exposure"],
    },
    {
      key: "admin",
      label: "Admin",
      defaultPanels: ["spend", "agents", "access", "audit", "resources", "idp"],
    },
  ],

  resourceTypes: {
    enabled: [
      "db",
      "internal",
      "sharepoint",
      "onedrive",
      "files",
      "s3",
      // Finance-specific systems
      "trading_system",
      "bloomberg",
      "reuters",
      "risk_engine",
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
        regulatoryFlags: ["SOX", "GLBA", "PCI-DSS", "SEC"],
      },
      {
        rank: 3,
        name: "restricted",
        regulatoryFlags: ["SOX", "GLBA", "PCI-DSS", "SEC", "FINRA", "MNPI"],
      },
    ],
  },

  dlpPatterns: [
    // ── Standard PII ──
    {
      name: "SSN",
      pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      severity: "critical",
      category: "pii",
    },
    {
      name: "Credit Card (PCI)",
      pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      severity: "critical",
      category: "financial",
    },
    {
      name: "Bank Account Number",
      pattern: "\\b\\d{8,17}\\b",
      severity: "critical",
      category: "financial",
    },
    // ── Finance-specific ──
    {
      name: "SWIFT/BIC Code",
      pattern: "\\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\\b",
      severity: "critical",
      category: "financial",
    },
    {
      name: "Trading Algorithm Reference",
      pattern: "(?i)\\b(algo|algorithm|strategy|signal)\\b.*[:=]\\s*[A-Z_]{3,}",
      flags: "i",
      severity: "critical",
      category: "proprietary",
    },
    {
      name: "Insider / MNPI",
      pattern:
        "(?i)\\b(MNPI|insider|material.?non.?public|pre.?announcement|earnings.?surprise)\\b",
      flags: "i",
      severity: "critical",
      category: "export_controlled",
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
  ],

  tierLabels: {
    critical: "Trade execution / risk gate agent",
    standard: "Research / reporting agent",
    background: "Batch analytics / reconciliation",
  },

  budgetPeriods: ["monthly", "quarterly"],

  modelRouting: {
    strategy: "edge-onprep-first",
    description:
      "On-prem GPU first (data residency + regulatory compliance). MNPI/restricted content never leaves the VPC.",
  },

  connectivity: {
    assumption: "cloud-native",
    offlinePolicyTtl: false,
  },

  stakeholderRouting: {
    mode: "single-human",
    description: "Single accountable human + compliance CC on all alerts.",
  },

  seedAgents: [
    {
      name: "TradeAnalysis-Agent",
      type: "claude_code",
      departmentName: "Trading",
      taskType: "trade_analysis",
      clearance: "confidential",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    {
      name: "RiskAssess-Agent",
      type: "claude_code",
      departmentName: "Risk Management",
      taskType: "risk_assessment",
      clearance: "restricted",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    {
      name: "ComplianceCheck-Bot",
      type: "opencode",
      departmentName: "Compliance",
      taskType: "compliance_review",
      clearance: "confidential",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
    {
      name: "QuantResearch-Agent",
      type: "pi",
      departmentName: "Quantitative Research",
      taskType: "quant_research",
      clearance: "restricted",
      tier: "standard",
      preferredModel: "qwen3.5",
    },
    {
      name: "Recon-Bot",
      type: "copilot",
      departmentName: "Operations",
      taskType: "reconciliation",
      clearance: "confidential",
      tier: "background",
      preferredModel: "minicpm5-1b",
    },
    {
      name: "AuditTrail-Agent",
      type: "claude_code",
      departmentName: "Audit",
      taskType: "audit_trail_analysis",
      clearance: "restricted",
      tier: "standard",
      preferredModel: "qwen3.5",
    },
    {
      name: "RegReport-Agent",
      type: "opencode",
      departmentName: "Compliance",
      taskType: "regulatory_reporting",
      clearance: "confidential",
      tier: "standard",
      preferredModel: "minicpm5-1b",
    },
    {
      name: "PortfolioAgent",
      type: "pi",
      departmentName: "Trading",
      taskType: "portfolio_optimization",
      clearance: "restricted",
      tier: "critical",
      preferredModel: "qwen3.5",
    },
  ],

  uiPanels: [
    { key: "spend", label: "Spend Overview", order: 0 },
    { key: "trade_volume", label: "Trade Volume", order: 1 },
    { key: "risk_exposure", label: "Risk Exposure", order: 2 },
    { key: "compliance_status", label: "Compliance Status", order: 3 },
    { key: "regulatory_deadlines", label: "Regulatory Deadlines", order: 4 },
    { key: "agents", label: "Agent Fleet", order: 5 },
    { key: "audit", label: "Audit Trail", order: 6 },
    { key: "access", label: "Access Control", order: 7 },
    { key: "idp", label: "Identity Providers", order: 8 },
  ],

  // ── Role presets (D8) — with Chinese-wall awareness ──
  rolePresets: [
    {
      key: "org_admin",
      label: "Org Admin",
      description: "Full authority: restructure any desk. Chief Compliance Officer equivalent.",
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
      key: "desk_head",
      label: "Desk Head",
      description:
        "Rename own desk; create + rename teams within own desk. Cannot cross Chinese walls.",
      scopeType: "department",
      permissions: ["org_node:create", "org_node:rename"],
    },
    {
      key: "compliance_officer",
      label: "Compliance Officer",
      description: "Read-only across all desks (audit authority). No org-tree edits.",
      scopeType: "org",
      singleton: true,
      permissions: [],
    },
    {
      key: "viewer",
      label: "Viewer",
      description: "Read-only within own desk.",
      scopeType: "department",
      permissions: [],
    },
  ],

  // ── Work-type taxonomies (D7) — per-desk label sets ──
  workTypeTaxonomies: [
    {
      departmentName: "Trading",
      labels: [
        "trade_analysis",
        "portfolio_optimization",
        "execution_strategy",
        "alpha_research",
        "position_rebalance",
      ],
      secondaryTagPresets: ["resource:trading_system", "resource:bloomberg"],
    },
    {
      departmentName: "Risk Management",
      labels: [
        "risk_assessment",
        "stress_test",
        "limit_review",
        "var_computation",
        "exposure_analysis",
      ],
    },
    {
      departmentName: "Compliance",
      labels: [
        "compliance_review",
        "regulatory_reporting",
        "policy_review",
        "mnpi_screening",
        "trade_surveillance",
      ],
    },
    {
      departmentName: "Quantitative Research",
      labels: [
        "quant_research",
        "model_backtest",
        "factor_analysis",
        "sharpe_optimization",
        "signal_research",
      ],
    },
    {
      departmentName: "Operations",
      labels: ["reconciliation", "settlement_check", "break_investigation", "t_plus_1_resolution"],
    },
    {
      departmentName: "Audit",
      labels: [
        "audit_trail_analysis",
        "forensic_review",
        "control_testing",
        "finding_documentation",
      ],
    },
  ],

  // ── Work packages (D9) — finance pilot set ───────────────────────────────
  workPackages: [
    {
      roleKey: "analyst_general",
      name: "Financial Analyst",
      family: "analysis",
      mode: "copilot",
      description:
        "Market-data research, spreadsheet analysis, and financial memos for analysts across desks.",
      tools: [
        { tool: "marketdata.bloomberg", toolVersion: "1.0.0" },
        { tool: "spreadsheets.excel", toolVersion: "1.2.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
      ],
      skills: ["financial-memo", "earnings-summary", "portfolio-brief"],
      subagentConfigs: [],
      permissions: [
        "tool:marketdata.bloomberg:invoke",
        "tool:spreadsheets.excel:invoke",
        "tool:web.search:invoke",
        "resource:bloomberg:read",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Summarize this morning's market moves and what they mean for our book",
        "Pull the latest consensus estimates for our top five holdings and compare them to guidance",
        "Draft a one-page memo on the sector re-rating for the investment committee",
      ],
      templateRefs: ["tpl.financial-memo", "tpl.earnings-summary"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["financial_analyst"],
    },
    {
      roleKey: "exec_assistant",
      name: "Executive Assistant",
      family: "executive",
      mode: "copilot",
      description:
        "KPI briefings, approvals inbox summaries, and web research for management. Aggregates-only — never raw content.",
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
        "Give me a one-page briefing on this week's risk and compliance KPIs",
        "Summarize the approvals waiting in my inbox and recommend which to review first",
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
        "Team ARM-adoption visibility, budget/spend oversight, and one-tap approvals for department leads — the decision-maker persona, not a hands-on tool user.",
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
  ],

  // ── Job-function taxonomy (D10) ──────────────────────────────────────────
  jobFunctions: FINANCE_JOB_FUNCTIONS,
};
