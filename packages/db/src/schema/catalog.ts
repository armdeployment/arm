/**
 * Work Packages (D9) — Tool Registry + role-scoped package catalog.
 *
 * A Work Package is the unit where governance and ease-of-use meet
 * (docs/solutions/2026-08-13-d9-work-packages.md): a versioned, role-scoped
 * bundle of tools (pinned versions), skills, sub-agent configs, permissions,
 * model routing, budget template, starter prompts, and templates — distributed
 * to employee agents via the ARM client.
 *
 * Governing rules (D6/D7 patterns): presets set defaults, never gate
 * capabilities; edits are copy-on-provisioning (pinning exact tool versions);
 * every row is `tenant_id`-scoped (Invariant 6). Tool endpoints carry a data
 * classification so the D2 classification gate extends from resources to tools.
 */

import { pgTable, uuid, text, jsonb, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import {
  toolKindEnum,
  toolReviewStatusEnum,
  workPackageModeEnum,
  packageAssignmentStatusEnum,
} from "./enums.js";
import { tenantTable } from "./org-tree.js";

/**
 * Tool — a first-class registry entity (MCP server / HTTP API / CLI / connector).
 * Authorization uses `tool:*` verbs (D8 extension) resolved by `resolveToolAccess`.
 * `data_classification` feeds the tool gate: a tool touching `restricted` data is
 * never callable from a closed external model (Invariant 1 + D2).
 */
export const toolTable = pgTable(
  "tool",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    name: text("name").notNull(),
    kind: toolKindEnum("kind").notNull(),
    endpoint: text("endpoint").notNull(),
    authStrategy: text("auth_strategy").notNull(), // oauth | pat | service_account | none
    dataClassification: text("data_classification").notNull(), // public..restricted
    ownerUserId: uuid("owner_user_id").notNull(),
    reviewStatus: toolReviewStatusEnum("review_status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One registry entry per tool name per tenant (slug uniqueness, M7).
    uniqueIndex("tool_tenant_id_name_uq").on(table.tenantId, table.name),
  ],
);

/**
 * ToolVersion — immutable manifest snapshots. Packages pin exact versions;
 * `manifest_sha256` enables integrity verification at install and at agent start.
 */
export const toolVersionTable = pgTable(
  "tool_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id), // denormalized for mandatory filter (D1-b)
    toolId: uuid("tool_id").notNull().references(() => toolTable.id),
    version: text("version").notNull(),
    manifestSha256: text("manifest_sha256").notNull(),
    configSchema: jsonb("config_schema").$type<Record<string, unknown>>().notNull().default({}),
    changelog: text("changelog").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One immutable snapshot per (tool, version) (M7) — packages pin exact versions.
    uniqueIndex("tool_version_tool_id_version_uq").on(table.toolId, table.version),
  ],
);

/**
 * WorkPackage — the role-scoped bundle definition. `role_key` is the stable
 * slug (`quality_engineer`); `family` groups variants (`quality_engineer_plant`
 * vs `_supplier`). `mode` = copilot (employee) or automated (scope-owned agent).
 */
export const workPackageTable = pgTable(
  "work_package",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    roleKey: text("role_key").notNull(),
    name: text("name").notNull(),
    family: text("family").notNull(),
    mode: workPackageModeEnum("mode").notNull().default("copilot"),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One role package per tenant (M7) — role_key is the stable slug.
    uniqueIndex("work_package_tenant_id_role_key_uq").on(table.tenantId, table.roleKey),
  ],
);

/** Versioned tool reference inside a package version. */
export interface WorkPackageToolRef {
  toolId: string;
  toolVersion: string;
  scopes: string[];
}

/**
 * WorkPackageVersion — the actual installable bundle. Immutable in practice:
 * edits create a new version (copy-on-provisioning, D7 lock). `manifest_sha256`
 * covers the canonical manifest JSON so the client can verify tamper-free config.
 */
export const workPackageVersionTable = pgTable(
  "work_package_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id), // denormalized for mandatory filter (D1-b)
    packageId: uuid("package_id").notNull().references(() => workPackageTable.id),
    version: text("version").notNull(),
    tools: jsonb("tools").$type<WorkPackageToolRef[]>().notNull().default([]),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    subagentConfigs: jsonb("subagent_configs").$type<string[]>().notNull().default([]),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    modelRouting: jsonb("model_routing").$type<Record<string, unknown>>().notNull().default({}),
    budgetTemplate: jsonb("budget_template").$type<Record<string, unknown>>().notNull().default({}),
    starterPrompts: jsonb("starter_prompts").$type<string[]>().notNull().default([]),
    templateRefs: jsonb("template_refs").$type<string[]>().notNull().default([]),
    minAgentVersion: text("min_agent_version").notNull().default("0.0.0"),
    manifestSha256: text("manifest_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One immutable version per (package, version) (M7) — copy-on-provisioning (D7).
    uniqueIndex("work_package_version_package_id_version_uq").on(table.packageId, table.version),
  ],
);

/**
 * PackageAssignment — the HR-style link between a package version and who may
 * use it: a user (copilot), an agent, or an org-tree node (bulk/automated).
 * Status: requested → approved → active → revoked, with approver + timestamps.
 */
export const packageAssignmentTable = pgTable("package_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  packageVersionId: uuid("package_version_id").notNull().references(
    () => workPackageVersionTable.id,
  ),
  assigneeType: text("assignee_type").notNull(), // user | agent | org_node
  assigneeId: uuid("assignee_id").notNull(),
  status: packageAssignmentStatusEnum("status").notNull().default("requested"),
  approverUserId: uuid("approver_user_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tool grant row shape — `tool:*` verbs resolved by resolveToolAccess (D9). */
export interface ToolGrantInput {
  tenantId: string;
  principalId: string;
  toolId: string;
  action: "invoke" | "configure" | "publish";
  deny: boolean;
  scopeType: string;
  scopeId: string;
}

/**
 * Slug-based tool pin inside a package SEED (M5). Seeds arrive from profile
 * presets referencing Tool Registry slugs ("jira") + exact versions — they do
 * NOT know database tool ids. Provisioning (`buildPackageVersionFromSeed` in
 * @arm/catalog) maps each slug through a slug→toolId map into the stored
 * `WorkPackageToolRef` ({ toolId, toolVersion, scopes }) shape; a slug missing
 * from the map is a provisioning error (fail loud, never store a dangling ref).
 */
export interface WorkPackageToolSeedInput {
  /** Tool slug from the Tool Registry (the `tool.name` unique key), e.g. "jira". */
  tool: string;
  /** Exact pinned version, e.g. "1.0.0". */
  toolVersion: string;
  /** Per-tool scope restrictions (least-privilege hints). */
  scopes: string[];
}

/** Pilot package seed shape (profiles → catalog provisioning). */
export interface WorkPackageSeedInput {
  roleKey: string;
  name: string;
  family: string;
  mode: "automated" | "copilot";
  description: string;
  tools: WorkPackageToolSeedInput[];
  skills: string[];
  subagentConfigs: string[];
  permissions: string[];
  modelRouting: Record<string, unknown>;
  budgetTemplate: Record<string, unknown>;
  starterPrompts: string[];
  templateRefs: string[];
  minAgentVersion: string;
}

/**
 * Budget reservation dimension (D9 — per-package / per-work-type).
 *
 * DELIBERATELY no unique index (M7 decision): `work_type` is nullable
 * (NULL = package-level cap, non-NULL = per-work-type cap), and PostgreSQL
 * treats NULLs as DISTINCT in unique indexes — a plain unique on
 * (tenant_id, package_id, work_type, period) would silently allow duplicate
 * NULL-work_type rows, while a partial index (`WHERE work_type IS NOT NULL`)
 * would add subtle semantics (uniqueness only for typed rows) that no
 * guardrail consumes yet. Revisit when reservation upsert semantics land
 * (write path must enforce idempotency explicitly).
 */
export const budgetReservationTable = pgTable("budget_reservation", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  packageId: uuid("package_id").references(() => workPackageTable.id),
  workType: text("work_type"),
  period: text("period").notNull(),
  usdCap: integer("usd_cap_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
