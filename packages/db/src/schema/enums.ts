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

/** Org-tree node type — the scope a principal/agent/budget/policy attaches to. */
export const scopeTypeEnum = pgEnum("scope_type", [
  "org",
  "department",
  "group",
  "team",
  "workstream",
]);

/** Agent priority tier (§6.6). Assignment is POLICY, not self-declared (Invariant 8). */
export const priorityTierEnum = pgEnum("priority_tier", [
  "critical",
  "standard",
  "background",
]);

/** Who spawned an agent. user-owned agents have owner_user_id set; scope-owned have it NULL. */
export const spawnedByEnum = pgEnum("spawned_by", ["user", "automation", "template"]);

/** LLM model custody: closed (provider-hosted) vs self_hosted (in-VPC). Drives DLP gate (§6.5). */
export const modelKindEnum = pgEnum("model_kind", ["closed", "self_hosted"]);

/** Resource type (spec §4.1 Resource). `files` is laptop-local — out of scope except classification tag. */
export const resourceTypeEnum = pgEnum("resource_type", [
  "db",
  "sharepoint",
  "gcs",
  "s3",
  "onedrive",
  "files",
  "internal",
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
