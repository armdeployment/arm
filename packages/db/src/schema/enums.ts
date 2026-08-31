/**
 * Shared enums for the ARM OLTP schema (spec §4.1).
 *
 * Kept in one file because Postgres enum values must be referenced by name from
 * multiple tables (deployment, scope_type, priority_tier, etc.) and Drizzle
 * requires a single enum definition per underlying Postgres type.
 */

import { pgEnum } from "drizzle-orm/pg-core";

/** Tenant deployment mode. SaaS = hosted control plane; self_hosted = single-tenant on-prem (§3.4, D1-b). */
export const deploymentEnum = pgEnum("deployment", ["saas", "self_hosted"]);

/**
 * Industry profile applied at provisioning (D6). DEFAULT-SOURCE ONLY — never
 * branched on at runtime. The guardrail `no-profile-branching` enforces that
 * proxy/policy/enforcement code never reads this value.
 */
export const industryProfileEnum = pgEnum("industry_profile", [
  "tech",
  "manufacturing",
  "finance",
  "holding",
  "custom",
]);

/**
 * Org-tree node type — the scope a principal/agent/budget/policy attaches to.
 * Manufacturing presets use plant/line/station for deep hierarchies (D6).
 * These are capabilities any tenant can use; profile only sets defaults.
 */
export const scopeTypeEnum = pgEnum("scope_type", [
  "org",
  "department",
  "group",
  "team",
  "workstream",
  // Manufacturing capabilities (D6) — tenant-toggleable, not mode-gated
  "plant",
  "line",
  "cell",
  "station",
]);

/** Agent priority tier (§6.6). Assignment is POLICY, not self-declared (Invariant 8). */
export const priorityTierEnum = pgEnum("priority_tier", ["critical", "standard", "background"]);

/** Who spawned an agent. user-owned agents have owner_user_id set; scope-owned have it NULL. */
export const spawnedByEnum = pgEnum("spawned_by", ["user", "automation", "template"]);

/** LLM model custody: closed (provider-hosted) vs self_hosted (in-VPC). Drives DLP gate (§6.5). */
export const modelKindEnum = pgEnum("model_kind", ["closed", "self_hosted"]);

/**
 * Resource type (spec §4.1 Resource). `files` is laptop-local — out of scope
 * except classification tag. OT (operational technology) types are manufacturing
 * capabilities (D6) — tenant-toggleable, not mode-gated.
 */
export const resourceTypeEnum = pgEnum("resource_type", [
  "db",
  "sharepoint",
  "gcs",
  "s3",
  "onedrive",
  "files",
  "internal",
  // OT capabilities (D6) — any tenant can enable via resource type allowlist
  "mes",
  "erp",
  "scada",
  "historian",
  "plm",
  "cmms",
  "iot",
]);

/** Vending strategy for a resource connector (spec §6.2). */
export const vendingStrategyEnum = pgEnum("vending_strategy", ["proxy", "mint", "sync"]);

/** Principal kind a permission grant attaches to. */
export const principalTypeEnum = pgEnum("principal_type", [
  "role",
  "agent",
  "team",
  "workstream",
  "dept",
]);

/** Access request lifecycle. */
export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "pending",
  "approved",
  "denied",
  "expired",
  "revoked",
]);

/** Access approval decision. */
export const approvalDecisionEnum = pgEnum("approval_decision", ["approved", "denied"]);

/** Agent status. */
export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "disabled",
  "retired",
  "throttled",
]);

/**
 * Work-type classifier stage (D7). Tracks which cascade stage resolved the
 * work-type tag for a prompt — enables re-labeling and gate-audit forensics.
 * `unknown` is a first-class label: stored as-is, never guessed.
 */
export const workTypeStageEnum = pgEnum("work_type_stage", [
  "structural",
  "cache",
  "linear",
  "embedding",
  "unknown",
]);

/**
 * Component kind (D10 — `tool` generalizes to `component`, A3). One registry
 * entity with a `kind` discriminator; no parallel skill/plugin tables.
 * Callable kinds (mcp/http_api/cli/connector) carry `tool:*` verbs (D8/D9,
 * unrenamed by design — docs/guides/00-shared-contracts.md §1); the rest are
 * installed, not invoked, and have no verb.
 */
export const componentKindEnum = pgEnum("component_kind", [
  "mcp",
  "http_api",
  "cli",
  "connector", // callable → tool:* verbs apply
  "plugin",
  "skill",
  "subagent",
  "template",
  "prompt_pack", // installable
]);

/** Component review lifecycle (D9/D10 — publish → approve workflow). */
export const componentReviewStatusEnum = pgEnum("component_review_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "deprecated",
]);

/** Component provenance (D10 A2/A3): first-party (ARM-shipped), tenant-authored
 *  (private to the tenant), or imported (from a discovery source). */
export const componentSourceKindEnum = pgEnum("component_source_kind", [
  "first_party",
  "tenant_authored",
  "imported",
]);

/** Blob storage backend for artifactory content (D10 A2 — pluggable blob backend). */
export const storageBackendEnum = pgEnum("storage_backend", ["fs", "s3", "oci"]);

/** Blob residency — control_plane (ARM-hosted, first-party only) vs tenant
 *  (customer VPC). Invariant 1: tenant-authored content never sits at
 *  control_plane residency (see guardrails/blob-residency). */
export const blobResidencyEnum = pgEnum("blob_residency", ["control_plane", "tenant"]);

/** Discovery source kind (D10 — where candidate components are pulled from). */
export const discoverySourceKindEnum = pgEnum("discovery_source_kind", [
  "mcp_registry",
  "git",
  "http_index",
  "marketplace",
]);

/** Discovery candidate triage lifecycle (D10). */
export const discoveryCandidateStatusEnum = pgEnum("discovery_candidate_status", [
  "new",
  "triaged",
  "promoted",
  "rejected",
]);

/** Questionnaire definition lifecycle (D10 — adoption-first onboarding). */
export const questionnaireStatusEnum = pgEnum("questionnaire_status", [
  "draft",
  "published",
  "archived",
]);

/**
 * Work-package deployment mode (D9). `copilot` = employee-adjacent,
 * human-in-the-loop (default for human job roles); `automated` = scope-owned
 * agent running unattended under policy + budget.
 */
export const workPackageModeEnum = pgEnum("work_package_mode", ["automated", "copilot"]);

/** Package-assignment lifecycle (D9): requested → approved → active → revoked. */
export const packageAssignmentStatusEnum = pgEnum("package_assignment_status", [
  "requested",
  "approved",
  "active",
  "revoked",
]);
