/**
 * Industry Profile type definitions (D6).
 *
 * A profile is a **provisioning-time bundle of default config** — pure data, never
 * code branches. The governing rule (docs/solutions/2026-08-02-d6-industry-profile.md):
 *
 *   "Everything that makes ARM good for manufacturing is a *capability* every
 *    tenant could have. The profile only ever sets *defaults* — it never gates
 *    a capability."
 *
 * After provisioning, a profile manifests as normal per-tenant config rows
 * (departments, classification levels, DLP patterns, resource types, etc.).
 * Runtime code reads config, never the profile id. The guardrail
 * `guardrails/no-profile-branching` enforces this.
 *
 * `packages/profiles` is a LEAF package — zero internal imports, sits beside
 * `proto`/`config` in the dependency DAG.
 */

// ── Org-tree convention ────────────────────────────────────────────────────

/**
 * A node in the organization tree seed (D6/D7 restructure).
 * Recursive — models HQ + plants + lines, or subsidiaries + their orgs.
 * Pure data; the provisioning step materializes this into org-tree rows.
 */
export interface OrgNodeSeed {
  /** Node type — determines scoping and UI presentation, NOT runtime branching. */
  type: "organization" | "hq" | "plant" | "department" | "group" | "line" | "cell";
  /** Display name, e.g. "Plant Detroit", "Corporate HQ", "Production Line A". */
  name: string;
  /** Physical location (primarily for plants). */
  location?: string;
  /** Monthly budget for this node in cents. */
  budgetMonthlyCents?: number;
  /** Children nodes (recursive). */
  children?: OrgNodeSeed[];
  /** Metadata tags (e.g. regulatory: ITAR, shift_pattern: 3x12). */
  tags?: Record<string, string>;
}

/**
 * Legacy flat department seed — kept for backward compat, but new profiles
 * should use the recursive OrgNodeSeed tree via `nodes`.
 */
export interface DepartmentSeed {
  name: string;
  parentName?: string;
  budgetMonthlyCents: number;
}

export interface OrgTreeConvention {
  /** "flat" (tech) or "deep" (manufacturing: HQ + Plants → Lines). */
  style: "flat" | "deep";
  /** Human-readable description for the onboarding wizard. */
  description: string;
  /** Recursive org tree nodes (new format — models HQ + plants + lines). */
  nodes: OrgNodeSeed[];
  /** Flat default departments (legacy — used by code that hasn't migrated). */
  defaultDepartments: DepartmentSeed[];
}

// ── Personas ───────────────────────────────────────────────────────────────

export interface PersonaDef {
  /** Machine key, e.g. "engineer", "plant_manager". */
  key: string;
  /** Display name, e.g. "Engineer", "Plant Manager". */
  label: string;
  /** Which UI panels this persona sees by default (panel keys). */
  defaultPanels: string[];
}

// ── Classification taxonomy ────────────────────────────────────────────────

export type ClassificationAxis = "sensitivity" | "regulatory";

export interface ClassificationLevelSeed {
  /** Ordered sensitivity rank (0 = least sensitive). */
  rank: number;
  /** Stable name, e.g. "public", "internal", "confidential", "restricted". */
  name: string;
  /**
   * Regulatory flags applicable at this level (dual-axis classification).
   * Empty for tech (single-axis). Manufacturing: e.g. ["ITAR", "EAR", "GxP"].
   */
  regulatoryFlags: string[];
}

export interface ClassificationTaxonomy {
  /** Which classification axes this profile uses by default. */
  axes: ClassificationAxis[];
  /** Ordered sensitivity levels. */
  levels: ClassificationLevelSeed[];
}

// ── DLP patterns ───────────────────────────────────────────────────────────

export type DLPSeverity = "critical" | "warning" | "info";

export interface DLPPatternSeed {
  /** Human-readable name, e.g. "SSN", "API Key (sk-ant-)", "CAD Geometry". */
  name: string;
  /**
   * Regex source string (NOT a RegExp object — profiles are serializable data).
   * The provisioning step compiles these into RegExp at load time.
   */
  pattern: string;
  /** Optional regex flags (e.g. "i" for case-insensitive). Defaults to "". */
  flags?: string;
  severity: DLPSeverity;
  /** Category for grouping in the UI. */
  category: "pii" | "secrets" | "financial" | "proprietary" | "export_controlled";
}

// ── Priority tiers ─────────────────────────────────────────────────────────

export interface TierLabels {
  critical: string;
  standard: string;
  background: string;
}

// ── Budget periods ─────────────────────────────────────────────────────────

export type BudgetPeriod = "monthly" | "shift" | "line" | "batch" | "quarterly";

// ── Model routing ──────────────────────────────────────────────────────────

export interface ModelRoutingDefault {
  /** "cost-steer-cloud" (tech) or "edge-onprem-first" (manufacturing). */
  strategy: "cost-steer-cloud" | "edge-onprep-first";
  description: string;
}

// ── Connectivity ───────────────────────────────────────────────────────────

export interface ConnectivityProfile {
  /** Cloud-native with remote=VPN, or air-gapped plants. */
  assumption: "cloud-native" | "air-gapped";
  /** Whether offline policy TTL + periodic sync is enabled by default. */
  offlinePolicyTtl: boolean;
}

// ── Stakeholder routing ────────────────────────────────────────────────────

export interface StakeholderRouting {
  /** "single-human" (tech) or "shift-duty-roster" (manufacturing). */
  mode: "single-human" | "shift-duty-roster";
  description: string;
}

// ── Seed agents ────────────────────────────────────────────────────────────

export interface SeedAgentDef {
  /** Display name, e.g. "CodeReview-Bot", "ToolPath-Optimizer". */
  name: string;
  /** Agent type: opencode / claude_code / copilot / pi / custom. */
  type: string;
  /** Department name this agent belongs to. */
  departmentName: string;
  /** What this agent does, e.g. "code_review", "cnc_toolpath_optimization". */
  taskType: string;
  /** Classification clearance: public / internal / confidential / restricted. */
  clearance: string;
  /** Priority tier: critical / standard / background. */
  tier: "critical" | "standard" | "background";
  /** Preferred model id. */
  preferredModel: string;
}

// ── UI home panels ─────────────────────────────────────────────────────────

export interface UIPanelDef {
  /** Stable key, e.g. "spend", "line_uptime", "maintenance_backlog". */
  key: string;
  /** Display label. */
  label: string;
  /** Sort order on the dashboard home. */
  order: number;
}

// ── Role presets (D8) ────────────────────────────────────────────────────

/**
 * A seeded role preset — a title-to-permission mapping attached to a scope,
 * provisioned by the profile at onboarding time, then editable by the
 * org_admin at runtime via /admin/roles.
 *
 * Governed by D6's rule unchanged: the profile seeds DEFAULTS, never gates a
 * capability. A tech tenant can define a `plant_manager` role too — they just
 * don't get it seeded. The guardrail `no-profile-branching` covers this: runtime
 * permission resolution reads roleTable rows (tenant config), never the profile.
 *
 * The two-step: profile → roleTable rows (seeded), then roleTable rows → permission
 * decisions (runtime). Step one is profile-driven; step two is not.
 */
export interface RolePresetDef {
  /** Stable key, e.g. "org_admin", "subsidiary_admin", "plant_manager". */
  key: string;
  /** Display name shown in /admin/roles — e.g. "Org Admin", "Plant Manager". */
  label: string;
  /** Human description of what this role can do. */
  description: string;
  /** Org-node-type the role is scoped to ("org" = tenant root). */
  scopeType: "org" | "organization" | "hq" | "plant" | "department" | "group" | "line";
  /** Permissions granted — "org_node:*" verbs + standard "resource:action" strings. */
  permissions: string[];
  /** True if seeded at the org root (single instance); false if per-node (multi-install). */
  singleton?: boolean;
}

// ── Work-type taxonomies (D7) ───────────────────────────────────────────────

/**
 * Per-department work-type label set (D7). Provisioned as `WorkTypeTaxonomy`
 * rows keyed by the agent's department scope. The classifier picks from
 * `labels`; `unknown` is first-class.
 */
export interface WorkTypeTaxonomySeed {
  /** Department name this taxonomy applies to (matches a defaultDepartment). */
  departmentName: string;
  /** Ordered primary labels the classifier picks from. */
  labels: string[];
  /** Optional secondary structural-tag presets. */
  secondaryTagPresets?: string[];
}

// ── Resource types ─────────────────────────────────────────────────────────

/**
 * Resource types enabled by default for this profile.
 * These are a SUBSET of the full resourceTypeEnum — the profile only sets
 * which ones are pre-enabled. Any tenant can enable any resource type.
 */
export interface ResourceTypeAllowlist {
  /** Resource type keys from resourceTypeEnum + manufacturing extensions. */
  enabled: string[];
}

// ── Job-function taxonomy (D10 — docs/guides/01-library-artifactory.md §3) ─

/**
 * A single job-function taxonomy entry — the questionnaire/recommendation
 * grouping key (D10, `docs/research/oem-job-taxonomy.md`). Pure data; the
 * provisioning step materializes this into `job_function` rows
 * (`packages/db/src/schema/artifactory.ts`).
 *
 * `key` is a stable snake_case slug (`quality_engineer`, `maintenance_technician`),
 * unique within a single profile's `jobFunctions` list. `aliases` carry the
 * synonyms an employee might pick in the questionnaire ("PQE", "product
 * quality engineer") — the `client` module maps free choices onto these, so
 * aliases matter. `headcountWeight` is a relative (fixture-only, not a real
 * customer metric) sizing hint used by gap analysis to rank uncovered job
 * functions — higher weight = more people typically hold this job type.
 */
export interface JobFunctionSeed {
  /** Stable machine key, e.g. "quality_engineer". Matches /^[a-z0-9_]+$/. */
  key: string;
  /** Display name, e.g. "Product Quality Engineer (PQE)". */
  name: string;
  /** Grouping family, e.g. "Quality Management" (docs/research/oem-job-taxonomy.md §2). */
  functionFamily: string;
  /** Synonyms an employee might type/select in the questionnaire. */
  aliases: string[];
  /** Relative headcount sizing hint (fixture data, not a real metric) — feeds gap-analysis ranking. */
  headcountWeight: number;
  /**
   * Go-to-market priority tier for this job function (business decision,
   * 2026-08-25): "beachhead" (senior managers — key decision maker, low-
   * hanging fruit), "neighboring" (PD-DRE / engineering product managers,
   * project managers), "other" (engineers — a differentiator, lower
   * priority). Undefined = not part of the explicit GTM sequencing (mostly
   * individual-contributor roles) — absence is not a demotion, just no
   * signal either way. Read by the onboarding UI to bias which role sorts
   * first in the questionnaire's role picker; never gates eligibility.
   */
  marketTier?: "beachhead" | "neighboring" | "other";
}

// ── Work packages (D9) ────────────────────────────────────────────────────

/**
 * A single tool pin inside a work package (D9).
 *
 * Packages pin EXACT tool versions — `toolVersion` is a semantic-version
 * triplet (e.g. "2.1.0"), never a range. The package is data, not code:
 * provisioning copies these seeds into `work_package_version` rows.
 */
export interface WorkPackageToolSeed {
  /** Tool slug from the Tool Registry, e.g. "spc.cmm-connector". */
  tool: string;
  /** Exact pinned version, e.g. "2.1.0". */
  toolVersion: string;
  /** Optional per-tool scope restrictions (least-privilege hints). */
  scopes?: string[];
}

/**
 * A role-scoped agent tool bundle (D9 — docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Everything an employee's agent needs to do their job: MCP tools, skills,
 * sub-agent configs, permission grants, model-routing policy, a budget
 * template, starter prompts, and document templates. Two modes:
 *
 *   - "automated": scope-owned agent, runs unattended.
 *   - "copilot":  employee-adjacent, human-in-the-loop (default for humans).
 *
 * Follows the D6 governing rule: presets set DEFAULTS, never gate a
 * capability — every tool/skill here is something any tenant could assemble.
 * Pure data, JSON-serializable, copy-on-provisioning (D7 lock).
 */
export interface WorkPackageSeed {
  /** Stable machine key, e.g. "quality_engineer". Matches /^[a-z0-9_]+$/. */
  roleKey: string;
  /** Display name, e.g. "Quality Engineer". */
  name: string;
  /** Role family for grouping/variants, e.g. "quality", "engineering". */
  family: string;
  /** "automated" (unattended, scope-owned) or "copilot" (human-in-the-loop). */
  mode: "automated" | "copilot";
  /** Human-readable description of what this package enables. */
  description: string;
  /** Pinned tools (Tool Registry slugs + exact versions). */
  tools: WorkPackageToolSeed[];
  /** Skill slugs installed with the package, e.g. "8d-report". */
  skills: string[];
  /** Sub-agent configuration names installed with the package. */
  subagentConfigs: string[];
  /** Permission grants — "tool:*:invoke" and "resource:*:*" strings (D8 extension). */
  permissions: string[];
  /** Model-routing policy: allowed_models, auto_downgrade_to, etc. Free-form map. */
  modelRouting: Record<string, unknown>;
  /** Budget template: monthly_usd_cap, critical_reserve_pct, etc. */
  budgetTemplate: Record<string, unknown>;
  /** Tappable first-task prompts for the employee's chat surface. */
  starterPrompts: string[];
  /** Document template references (content-addressed in the catalog). */
  templateRefs: string[];
  /** Minimum agent runtime version this package config requires. */
  minAgentVersion: string;
  /**
   * Job-function keys this package serves (D10) — must resolve to keys
   * present in the profile's own `jobFunctions` taxonomy list. Feeds
   * `work_package_job_function` coverage mapping and gap analysis
   * (docs/guides/01-library-artifactory.md §3 bullet 5).
   */
  jobFunctions: string[];
}

// ── The full profile preset ────────────────────────────────────────────────

export type ProfileId = "tech" | "manufacturing" | "finance" | "holding" | "custom";

export interface IndustryProfilePreset {
  /** Stable profile id. */
  id: ProfileId;
  /** Display label for the onboarding wizard. */
  label: string;
  /** Short description. */
  description: string;

  orgTree: OrgTreeConvention;
  personas: PersonaDef[];
  resourceTypes: ResourceTypeAllowlist;
  classification: ClassificationTaxonomy;
  dlpPatterns: DLPPatternSeed[];
  tierLabels: TierLabels;
  budgetPeriods: BudgetPeriod[];
  modelRouting: ModelRoutingDefault;
  connectivity: ConnectivityProfile;
  stakeholderRouting: StakeholderRouting;
  seedAgents: SeedAgentDef[];
  uiPanels: UIPanelDef[];

  /** Role presets (D8) — title → permission bundle → scope mappings seeded
   *  at provisioning time, editable afterwards via /admin/roles. */
  rolePresets: RolePresetDef[];
  /** Per-department work-type taxonomies (D7). */
  workTypeTaxonomies: WorkTypeTaxonomySeed[];
  /** Work packages (D9) — role-scoped tool bundles seeded at provisioning
   *  time, then governed per-package (budgets, approvals, metering). */
  workPackages: WorkPackageSeed[];
  /** Job-function taxonomy (D10) — the questionnaire/recommendation grouping
   *  key. Every `WorkPackageSeed.jobFunctions` entry across this profile must
   *  resolve to a `key` in this list (packages/profiles/test/profiles.test.ts). */
  jobFunctions: JobFunctionSeed[];
}
