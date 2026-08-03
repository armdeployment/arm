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

export interface DepartmentSeed {
  name: string;
  parentName?: string; // null/undefined = top-level
  budgetMonthlyCents: number;
}

export interface OrgTreeConvention {
  /** "flat" (tech) or "deep" (manufacturing: Plant → Line/Cell → Station + shift). */
  style: "flat" | "deep";
  /** Human-readable description for the onboarding wizard. */
  description: string;
  /** Default departments to seed. */
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
  /** Per-department work-type taxonomies (D7). */
  workTypeTaxonomies: WorkTypeTaxonomySeed[];
}
