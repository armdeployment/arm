/**
 * Tech company Industry Profile preset (D6).
 *
 * Pure data. Applies at tenant provisioning time. After provisioning, these
 * values become per-tenant config rows — runtime code never reads `id: "tech"`.
 */

import type { IndustryProfilePreset } from "./types";

export const techProfile: IndustryProfilePreset = {
  id: "tech",
  label: "Tech / Software",
  description:
    "Software-first company: flat org, cloud-native agents, single-axis classification, cost-steer to open models.",

  // ── Org-tree: flat (Eng/Product/Sales/CS/Marketing) ──────────────────────
  orgTree: {
    style: "flat",
    description: "Flat hierarchy: Organization → Department → Team → Workstream.",
    defaultDepartments: [
      { name: "Engineering", budgetMonthlyCents: 8000_00 },
      { name: "Product", budgetMonthlyCents: 4000_00 },
      { name: "Sales", budgetMonthlyCents: 3000_00 },
      { name: "Customer Success", budgetMonthlyCents: 2000_00 },
      { name: "Marketing", budgetMonthlyCents: 2000_00 },
    ],
  },

  // ── Personas (spec §2) ──────────────────────────────────────────────────
  personas: [
    { key: "engineer", label: "Engineer", defaultPanels: ["spend", "agents", "audit"] },
    { key: "manager", label: "Manager", defaultPanels: ["spend", "agents", "savings"] },
    { key: "admin", label: "Admin", defaultPanels: ["spend", "agents", "access", "audit", "resources", "idp"] },
    { key: "infosec", label: "InfoSec", defaultPanels: ["audit", "access", "security"] },
    { key: "marketer", label: "Marketer", defaultPanels: ["spend", "savings"] },
    { key: "sales", label: "Sales", defaultPanels: ["spend"] },
  ],

  // ── Resource types (cloud-native) ───────────────────────────────────────
  resourceTypes: {
    enabled: ["s3", "gcs", "db", "sharepoint", "onedrive", "files", "internal"],
  },

  // ── Classification: single-axis ─────────────────────────────────────────
  classification: {
    axes: ["sensitivity"],
    levels: [
      { rank: 0, name: "public", regulatoryFlags: [] },
      { rank: 1, name: "internal", regulatoryFlags: [] },
      { rank: 2, name: "confidential", regulatoryFlags: [] },
      { rank: 3, name: "restricted", regulatoryFlags: [] },
    ],
  },

  // ── DLP patterns (PII + secrets) ────────────────────────────────────────
  dlpPatterns: [
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
      name: "OpenAI API Key",
      pattern: "sk-[a-zA-Z0-9]{40,}",
      severity: "critical",
      category: "secrets",
    },
    {
      name: "Credit Card",
      pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      severity: "warning",
      category: "financial",
    },
    {
      name: "Email Address",
      pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
      severity: "info",
      category: "pii",
    },
  ],

  // ── Priority tiers ──────────────────────────────────────────────────────
  tierLabels: {
    critical: "Incident / hot-issue resolver",
    standard: "CI / engineering agent",
    background: "UX optimization / upgrades / experiments",
  },

  // ── Budget periods ──────────────────────────────────────────────────────
  budgetPeriods: ["monthly"],

  // ── Model routing ───────────────────────────────────────────────────────
  modelRouting: {
    strategy: "cost-steer-cloud",
    description: "Cost-steer toward open cloud models (GLM/DeepSeek) by default.",
  },

  // ── Connectivity ────────────────────────────────────────────────────────
  connectivity: {
    assumption: "cloud-native",
    offlinePolicyTtl: false,
  },

  // ── Stakeholder routing ─────────────────────────────────────────────────
  stakeholderRouting: {
    mode: "single-human",
    description: "Single accountable human, business-hours alerts.",
  },

  // ── Seed agents (tech-focused) ──────────────────────────────────────────
  seedAgents: [
    { name: "incident-triage", type: "claude_code", departmentName: "Engineering", taskType: "incident_triage", clearance: "internal", tier: "critical", preferredModel: "qwen3.5" },
    { name: "hot-issue-resolver", type: "claude_code", departmentName: "Engineering", taskType: "hot_issue_resolution", clearance: "internal", tier: "critical", preferredModel: "qwen3.5" },
    { name: "code-review-bot", type: "claude_code", departmentName: "Engineering", taskType: "code_review", clearance: "internal", tier: "standard", preferredModel: "qwen3.5" },
    { name: "test-gen", type: "copilot", departmentName: "Engineering", taskType: "test_generation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "doc-writer", type: "opencode", departmentName: "Product", taskType: "documentation", clearance: "internal", tier: "standard", preferredModel: "minicpm5-1b" },
    { name: "ux-optimizer", type: "opencode", departmentName: "Product", taskType: "ux_optimization", clearance: "internal", tier: "background", preferredModel: "minicpm5-1b" },
    { name: "data-pipeline-monitor", type: "pi", departmentName: "Engineering", taskType: "pipeline_monitoring", clearance: "internal", tier: "background", preferredModel: "minicpm5-1b" },
    { name: "upgrade-bot", type: "opencode", departmentName: "Engineering", taskType: "dependency_upgrade", clearance: "internal", tier: "background", preferredModel: "minicpm5-1b" },
  ],

  // ── UI home panels ──────────────────────────────────────────────────────
  uiPanels: [
    { key: "spend", label: "Spend Overview", order: 0 },
    { key: "agents", label: "Agent Fleet", order: 1 },
    { key: "savings", label: "Savings Estimator", order: 2 },
    { key: "access", label: "Access Control", order: 3 },
    { key: "audit", label: "Audit Trail", order: 4 },
    { key: "resources", label: "Resources", order: 5 },
    { key: "idp", label: "Identity Providers", order: 6 },
  ],

  // ── Work-type taxonomies (D7) — per-department label sets ──
  workTypeTaxonomies: [
    {
      departmentName: "Engineering",
      labels: [
        "code_review", "code_generation", "test_generation", "hot_issue_resolution",
        "incident_triage", "architecture_design", "devops_automation",
        "dependency_upgrade", "pipeline_monitoring", "cybersecurity_scan",
      ],
      secondaryTagPresets: ["tool:web_search", "tool:code_search", "model:claude-sonnet"],
    },
    {
      departmentName: "Product",
      labels: ["documentation", "ux_optimization", "product_spec", "user_research", "roadmap_planning"],
    },
    { departmentName: "Sales", labels: ["outreach_drafting", "crm_update", "lead_research"] },
    { departmentName: "Customer Success", labels: ["support_reply", "onboarding_guide", "ticket_triage"] },
    { departmentName: "Marketing", labels: ["content_drafting", "seo_research", "campaign_analysis"] },
  ],
};
