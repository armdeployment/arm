/**
 * Tech company Industry Profile preset (D6).
 *
 * Pure data. Applies at tenant provisioning time. After provisioning, these
 * values become per-tenant config rows — runtime code never reads `id: "tech"`.
 */

import type { IndustryProfilePreset } from "./types.js";
import { TECH_JOB_FUNCTIONS } from "./job-taxonomy.tech.js";

export const techProfile: IndustryProfilePreset = {
  id: "tech",
  label: "Tech / Software",
  description:
    "Software-first company: flat org, cloud-native agents, single-axis classification, cost-steer to open models.",

  // ── Org-tree: flat (Eng/Product/Sales/CS/Marketing) ──────────────────────
  orgTree: {
    style: "flat",
    description: "Flat hierarchy: Organization → Department → Team → Workstream.",
    nodes: [
      { type: "department", name: "Engineering", budgetMonthlyCents: 8000_00 },
      { type: "department", name: "Product", budgetMonthlyCents: 4000_00 },
      { type: "department", name: "Sales", budgetMonthlyCents: 3000_00 },
      { type: "department", name: "Customer Success", budgetMonthlyCents: 2000_00 },
      { type: "department", name: "Marketing", budgetMonthlyCents: 2000_00 },
    ],
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

  // ── Role presets (D8) — simpler flat-org authority ──
  rolePresets: [
    {
      key: "org_admin", label: "Org Admin",
      description: "Full authority: add, rename, reparent, delete any department or team.",
      scopeType: "org", singleton: true,
      permissions: ["org_node:create", "org_node:rename", "org_node:reparent", "org_node:delete", "*"]
    },
    {
      key: "dept_head", label: "Department Head",
      description: "Rename own department; create + rename teams within own department.",
      scopeType: "department",
      permissions: ["org_node:create", "org_node:rename"]
    },
    {
      key: "viewer", label: "Viewer",
      description: "Read-only access to dashboards.",
      scopeType: "department",
      permissions: []
    },
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

  // ── Work packages (D9) — tech pilot set ──────────────────────────────────
  workPackages: [
    {
      roleKey: "code_reviewer",
      name: "Code Reviewer",
      family: "engineering",
      mode: "copilot",
      description: "Pull-request review, code search, and CI status triage for engineering teams.",
      tools: [
        { tool: "git.repo", toolVersion: "2.0.0" },
        { tool: "code.search", toolVersion: "1.3.0" },
        { tool: "ci.status", toolVersion: "1.0.0" },
      ],
      skills: ["pr-summary", "style-lint", "security-scan"],
      subagentConfigs: ["pr-reviewer"],
      permissions: [
        "tool:git.repo:invoke",
        "tool:code.search:invoke",
        "tool:ci.status:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Review the open pull request I just linked and summarize what needs attention",
        "Search the codebase for where API rate limiting is implemented",
        "Tell me which CI jobs are failing right now and what likely broke them",
      ],
      templateRefs: ["tpl.pr-summary", "tpl.security-scan"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["code_reviewer"],
    },
    {
      roleKey: "backend_engineer",
      name: "Backend Engineer",
      family: "engineering",
      mode: "copilot",
      description: "API design, database access, and deployment tooling for backend engineers.",
      tools: [
        { tool: "git.repo", toolVersion: "2.0.0" },
        { tool: "code.search", toolVersion: "1.3.0" },
        { tool: "db.client", toolVersion: "1.4.0" },
        { tool: "deploy.cd", toolVersion: "1.1.0" },
      ],
      skills: ["api-design", "migration-generator", "incident-runbook"],
      subagentConfigs: ["api-drafter", "migration-checker"],
      permissions: [
        "tool:git.repo:invoke",
        "tool:code.search:invoke",
        "tool:db.client:invoke",
        "tool:deploy.cd:invoke",
        "resource:db:read",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Draft the API endpoint spec for user settings sync",
        "Generate the database migration for adding the audit_log table",
        "Walk me through the incident runbook for a failing payment webhook",
      ],
      templateRefs: ["tpl.api-spec", "tpl.migration", "tpl.runbook"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["backend_engineer"],
    },
    {
      roleKey: "frontend_engineer",
      name: "Frontend Engineer",
      family: "engineering",
      mode: "copilot",
      description: "Component building, design-token audits, and accessibility checks for frontend engineers.",
      tools: [
        { tool: "git.repo", toolVersion: "2.0.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
        { tool: "figma.design", toolVersion: "1.0.0" },
      ],
      skills: ["component-builder", "design-token-audit", "a11y-checklist"],
      subagentConfigs: [],
      permissions: [
        "tool:git.repo:invoke",
        "tool:web.search:invoke",
        "tool:figma.design:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 400, critical_reserve_pct: 10 },
      starterPrompts: [
        "Build the settings card component from the Figma link I pasted",
        "Run an accessibility checklist on the checkout page and list what to fix",
        "Find where our spacing tokens are defined and list any inconsistent values",
      ],
      templateRefs: ["tpl.component", "tpl.a11y-checklist"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["frontend_engineer"],
    },
    {
      roleKey: "data_scientist",
      name: "Data Scientist",
      family: "data",
      mode: "copilot",
      description: "Lakehouse SQL, notebook exploration, and model evaluation for the data team.",
      tools: [
        { tool: "lakehouse.sql", toolVersion: "1.2.0" },
        { tool: "notebook.jupyter", toolVersion: "2.1.0" },
        { tool: "web.search", toolVersion: "1.0.0" },
      ],
      skills: ["eda-template", "model-eval", "dashboard-builder"],
      subagentConfigs: [],
      permissions: [
        "tool:lakehouse.sql:invoke",
        "tool:notebook.jupyter:invoke",
        "tool:web.search:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 500, critical_reserve_pct: 10 },
      starterPrompts: [
        "Explore the signup funnel table and tell me where the biggest drop-off is",
        "Compare the two model versions and summarize which one wins and why",
        "Build a dashboard of weekly active users by plan for the product review",
      ],
      templateRefs: ["tpl.eda-notebook", "tpl.model-eval", "tpl.dashboard"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["data_scientist"],
    },
    {
      roleKey: "exec_assistant",
      name: "Executive Assistant",
      family: "executive",
      mode: "copilot",
      description: "KPI briefings, approvals inbox summaries, and web research for executives. Aggregates-only — never raw content.",
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
        "Give me a one-page briefing on this week's company KPIs",
        "Summarize the approvals waiting in my inbox and recommend which to review first",
        "Research our two main competitors and summarize their latest product moves",
        "Draft my monthly exec digest for the leadership team",
      ],
      templateRefs: ["tpl.kpi-briefing", "tpl.exec-digest", "tpl.approval-summary"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["executive_assistant"],
    },
    {
      roleKey: "devops_engineer",
      name: "DevOps Engineer",
      family: "engineering",
      mode: "copilot",
      description: "CI pipelines, SBOM generation, and shift-left security for platform DevOps engineers.",
      tools: [
        { tool: "vcs.gitlab", toolVersion: "2.4.0" },
        { tool: "vcs.azure-devops", toolVersion: "2.0.0" },
        { tool: "git.repo", toolVersion: "2.0.0" },
      ],
      skills: ["ci-pipeline", "sbom-generation", "shift-left-security"],
      subagentConfigs: [],
      permissions: [
        "tool:vcs.gitlab:invoke",
        "tool:vcs.azure-devops:invoke",
        "tool:git.repo:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Generate a CI pipeline for the embedded repo with MISRA checks",
        "Draft the dynamic SBOM for release 3.1",
        "Fix this failing GitLab runner job",
      ],
      templateRefs: ["tpl.ci-pipeline", "tpl.sbom", "tpl.shift-left-security"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["devops_engineer"],
    },
    {
      roleKey: "embedded_engineer",
      name: "Embedded Engineer",
      family: "embedded_software",
      mode: "copilot",
      description: "Model-based code generation and CAN bus log analysis for embedded engineers.",
      tools: [
        { tool: "mdl.matlab-simulink", toolVersion: "2.1.0" },
        { tool: "test.canoe", toolVersion: "1.9.0" },
        { tool: "autosar.tresos", toolVersion: "1.2.0" },
      ],
      skills: ["model-codegen", "bus-log-analysis"],
      subagentConfigs: [],
      permissions: [
        "tool:mdl.matlab-simulink:invoke",
        "tool:test.canoe:invoke",
        "tool:autosar.tresos:invoke",
      ],
      modelRouting: {
        allowed_models: ["claude-sonnet", "minicpm5-1b"],
        auto_downgrade_to: "minicpm5-1b",
      },
      budgetTemplate: { monthly_usd_cap: 300, critical_reserve_pct: 10 },
      starterPrompts: [
        "Generate C code from this Simulink model",
        "Analyze these CAN logs for message timing violations",
        "Trace this AUTOSAR module to its requirements",
      ],
      templateRefs: ["tpl.model-codegen", "tpl.bus-log-analysis"],
      minAgentVersion: "1.0.0",
      jobFunctions: ["embedded_engineer"],
    },
  ],

  // ── Job-function taxonomy (D10) ──────────────────────────────────────────
  jobFunctions: TECH_JOB_FUNCTIONS,
};
