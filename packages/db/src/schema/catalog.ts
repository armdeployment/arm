/**
 * Work Packages (D9, updated D10) — role-scoped package catalog.
 *
 * A Work Package is the unit where governance and ease-of-use meet
 * (docs/solutions/2026-08-13-d9-work-packages.md): a versioned, role-scoped
 * bundle of components (pinned versions, `packages/db/src/schema/artifactory.ts`),
 * permissions, model routing, budget template, and starter prompts —
 * distributed to employee agents via the ARM client.
 *
 * D10 cutover (guide 00 §1/§3.3, A3): `tool`/`tool_version` are replaced by
 * `component`/`component_version` (artifactory.ts). `tools`, `skills`,
 * `subagent_configs`, and `template_refs` on `work_package_version` are
 * replaced by a single `components` ref array (`ComponentRef[]`, manifest v2
 * field #2) plus `job_functions`. There is no production data — no
 * compatibility shim, no dual-read path.
 *
 * Governing rules (D6/D7 patterns): presets set defaults, never gate
 * capabilities; edits are copy-on-provisioning (pinning exact component
 * versions); every row is `tenant_id`-scoped (Invariant 6).
 */

import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workPackageModeEnum, packageAssignmentStatusEnum } from "./enums.js";
import { tenantTable } from "./org-tree.js";

/**
 * WorkPackage — the role-scoped bundle definition. `role_key` is the stable
 * slug (`quality_engineer`); `family` groups variants (`quality_engineer_plant`
 * vs `_supplier`). `mode` = copilot (employee) or automated (scope-owned agent).
 * `approval_required` (A6): when false, questionnaire recommendations for this
 * package auto-approve; when true (the default), a recommendation routes to
 * an approver instead of auto-provisioning.
 *
 * DB-level only, not modeled here: migration 0004 adds a generated
 * `search_vector` tsvector column (name/description) + GIN index, plus a
 * pg_trgm GIN index on `role_key` — read by
 * `packages/discovery/src/search.ts`'s `buildWorkPackageSearchSql` (guide 01
 * §6.1). Drizzle has no first-class tsvector column type, so it isn't
 * declared as a field on this table.
 */
export const workPackageTable = pgTable(
  "work_package",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantTable.id),
    roleKey: text("role_key").notNull(),
    name: text("name").notNull(),
    family: text("family").notNull(),
    mode: workPackageModeEnum("mode").notNull().default("copilot"),
    description: text("description").notNull().default(""),
    approvalRequired: boolean("approval_required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One role package per tenant (M7) — role_key is the stable slug.
    uniqueIndex("work_package_tenant_id_role_key_uq").on(table.tenantId, table.roleKey),
  ],
);

/** Versioned component reference inside a package version (D10 — replaces
 *  `WorkPackageToolRef`). Mirrors manifest v2 field #2 (`ComponentRef`,
 *  guide 00 §4): `{ component_id, version, kind, scopes[] }`, camelCase here
 *  for the DB-side jsonb source shape (wire/canonical form is snake_case,
 *  see `@arm/proto`'s `componentRefSchema`). */
export interface WorkPackageComponentRef {
  componentId: string;
  version: string;
  /** Denormalized from `component.kind` at pin time — lets the manifest and
   *  the `tool:*` verb gate resolve callability without an extra join. */
  kind: string;
  scopes: string[];
}

/**
 * WorkPackageVersion — the actual installable bundle. Immutable in practice:
 * edits create a new version (copy-on-provisioning, D7 lock). `manifest_sha256`
 * covers the canonical manifest v2 JSON (guide 00 §4 — 8 fields, snake_case,
 * sorted arrays) so the client can verify tamper-free config.
 */
export const workPackageVersionTable = pgTable(
  "work_package_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantTable.id), // denormalized for mandatory filter (D1-b)
    packageId: uuid("package_id")
      .notNull()
      .references(() => workPackageTable.id),
    version: text("version").notNull(),
    /** Manifest wire-shape version — 2 = the D10 component/job_functions
     *  manifest (guide 00 §4). There is no v1 reader; this column exists so a
     *  future v3 break has somewhere to pivot on. */
    manifestVersion: integer("manifest_version").notNull().default(2),
    components: jsonb("components").$type<WorkPackageComponentRef[]>().notNull().default([]),
    jobFunctions: jsonb("job_functions").$type<string[]>().notNull().default([]),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    modelRouting: jsonb("model_routing").$type<Record<string, unknown>>().notNull().default({}),
    budgetTemplate: jsonb("budget_template").$type<Record<string, unknown>>().notNull().default({}),
    starterPrompts: jsonb("starter_prompts").$type<string[]>().notNull().default([]),
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
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  packageVersionId: uuid("package_version_id")
    .notNull()
    .references(() => workPackageVersionTable.id),
  assigneeType: text("assignee_type").notNull(), // user | agent | org_node
  assigneeId: uuid("assignee_id").notNull(),
  status: packageAssignmentStatusEnum("status").notNull().default("requested"),
  approverUserId: uuid("approver_user_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tool grant row shape — `tool:*` verbs resolved by resolveToolAccess (D9).
 * NOTE (D10, guide 00 §1): permission verbs do not rename — `tool:invoke` /
 * `tool:configure` / `tool:publish` stay as-is and now apply only to
 * *callable* components (`kind ∈ {mcp, http_api, cli, connector}`,
 * `packages/db/src/schema/artifactory.ts`). `toolId` here is that callable
 * component's id; the field keeps its historical name because the verb it
 * gates kept its historical name too.
 */
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
 * Slug-based component pin inside a package SEED (D10 — replaces
 * `WorkPackageToolSeedInput`/M5). Seeds arrive from profile presets
 * referencing Component Registry slugs ("jira") + exact versions — they do
 * NOT know database component ids. Provisioning (`buildPackageVersionFromSeed`
 * in @arm/catalog) maps each slug through a slug→componentId map into the
 * stored `WorkPackageComponentRef` ({ componentId, version, kind, scopes })
 * shape; a slug missing from the map is a provisioning error (fail loud,
 * never store a dangling ref).
 */
export interface WorkPackageComponentSeedInput {
  /** Component slug from the Component Registry (the `component.slug` unique key), e.g. "jira". */
  component: string;
  /** Exact pinned version, e.g. "1.0.0". */
  componentVersion: string;
  /** Denormalized `component.kind` at pin time. */
  kind: string;
  /** Per-component scope restrictions (least-privilege hints). */
  scopes: string[];
}

/** Pilot package seed shape (profiles → catalog provisioning), D10 shape. */
export interface WorkPackageSeedInput {
  roleKey: string;
  name: string;
  family: string;
  mode: "automated" | "copilot";
  description: string;
  approvalRequired: boolean;
  components: WorkPackageComponentSeedInput[];
  jobFunctions: string[];
  permissions: string[];
  modelRouting: Record<string, unknown>;
  budgetTemplate: Record<string, unknown>;
  starterPrompts: string[];
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
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  packageId: uuid("package_id").references(() => workPackageTable.id),
  workType: text("work_type"),
  period: text("period").notNull(),
  usdCap: integer("usd_cap_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
