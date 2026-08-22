/**
 * Artifactory — the D10 component registry (docs/guides/00-shared-contracts.md
 * §1/§3.1, docs/solutions/2026-08-21-d10-adoption-first-restructure.md).
 *
 * `tool` generalizes to `component` (A3): one registry entity with a `kind`
 * discriminator, immutable content-addressed versions, and a pluggable blob
 * backend (A2 — a real artifactory, not a metadata-only registry). This
 * replaces `tool`/`tool_version` (packages/db/src/schema/catalog.ts) — there
 * is no production data, so this is a clean cutover with no compatibility
 * shim (guide 00 §1).
 *
 * Job functions (the taxonomy `work_package` and `component` attach to for
 * questionnaire-driven recommendation) and discovery (external source →
 * candidate → promoted component pipeline) live here too — both are
 * artifactory-adjacent concerns owned by the same `library` Wave-1 module.
 *
 * NOTE (contracts / Wave 0): this file lands the SHAPE only — tables,
 * constraints, and doc comments. No fixtures, no provisioning logic, no
 * business rules beyond what Postgres itself enforces. Filled in by `library`
 * (Wave 1) per docs/guides/01-library-artifactory.md.
 */

import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  bigint,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import {
  componentKindEnum,
  componentReviewStatusEnum,
  componentSourceKindEnum,
  storageBackendEnum,
  blobResidencyEnum,
  discoverySourceKindEnum,
  discoveryCandidateStatusEnum,
} from "./enums.js";
import { tenantTable } from "./org-tree.js";

/**
 * Component — a first-class registry entity (MCP server / HTTP API / CLI /
 * connector / plugin / skill / subagent / template / prompt_pack).
 * `tool:*` verbs (D8/D9, unrenamed) resolve only for callable kinds
 * (mcp/http_api/cli/connector) via `resolveToolAccess`; the rest are
 * installed, not invoked, and carry no verb (docs/CONCEPTS.md).
 * `data_classification` feeds the tool gate: a component touching
 * `restricted` data is never callable from a closed external model
 * (Invariant 1 + D2).
 */
export const componentTable = pgTable(
  "component",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    slug: text("slug").notNull(),
    kind: componentKindEnum("kind").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ownerUserId: uuid("owner_user_id").notNull(),
    reviewStatus: componentReviewStatusEnum("review_status").notNull().default("draft"),
    sourceKind: componentSourceKindEnum("source_kind").notNull().default("first_party"),
    /** Provenance ref — discovery candidate id, git URL, marketplace listing id, etc. */
    sourceRef: text("source_ref").notNull().default(""),
    /** NULL for non-callable (installable) components — they have no endpoint. */
    endpoint: text("endpoint"),
    /** NULL for non-callable components. oauth | pat | service_account | none. */
    authStrategy: text("auth_strategy"),
    dataClassification: text("data_classification").notNull(), // public..restricted
    homepageUrl: text("homepage_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("component_tenant_id_slug_uq").on(table.tenantId, table.slug)],
);

/** A component's `requires` entry — another component this version depends on. */
export interface ComponentRequires {
  component_slug: string;
  range: string;
}

/**
 * ComponentVersion — immutable, content-addressed manifest snapshot.
 * `manifest_sha256` covers the canonical manifest JSON (manifest v2 —
 * guide 00 §4); `blob_digest` (when present) is a verified `sha256:<hex>`
 * pointer into `component_blob` — never a mutable URL (guardrails/
 * artifact-integrity).
 */
export const componentVersionTable = pgTable(
  "component_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id), // denormalized for mandatory filter (D1-b)
    componentId: uuid("component_id").notNull().references(() => componentTable.id),
    version: text("version").notNull(),
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
    manifestSha256: text("manifest_sha256").notNull(),
    /** "sha256:<hex>" — NULL for manifest-only (no-blob) components. */
    blobDigest: text("blob_digest"),
    blobSizeBytes: bigint("blob_size_bytes", { mode: "number" }),
    blobMediaType: text("blob_media_type"),
    configSchema: jsonb("config_schema").$type<Record<string, unknown>>().notNull().default({}),
    requires: jsonb("requires").$type<ComponentRequires[]>().notNull().default([]),
    changelog: text("changelog").notNull().default(""),
    yanked: boolean("yanked").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by"),
  },
  (table) => [
    uniqueIndex("component_version_component_id_version_uq").on(table.componentId, table.version),
  ],
);

/**
 * ComponentBlob — content-addressed binary storage, pluggable backend (A2).
 * `digest` ("sha256:<hex>") is the primary key: the same bytes are stored
 * once regardless of how many component versions reference them.
 *
 * `tenant_id` is nullable ONLY for `residency = 'control_plane'` first-party
 * artifacts (ARM-shipped components with no single owning tenant) — this is
 * the one documented exemption from the tenant_id-NOT-NULL rule (guide 00
 * §3.1); every other artifactory table carries `tenant_id NOT NULL`. See
 * `scripts/guardrails/src/checks/tenant-isolation.ts` for the matching guard
 * exemption, and `blob-residency` for the Invariant-1 rule this enables:
 * tenant-authored content must never sit at control_plane residency.
 */
export const componentBlobTable = pgTable("component_blob", {
  digest: text("digest").primaryKey(), // "sha256:<hex>"
  tenantId: uuid("tenant_id").references(() => tenantTable.id), // nullable — see doc comment above
  mediaType: text("media_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  storageBackend: storageBackendEnum("storage_backend").notNull(),
  residency: blobResidencyEnum("residency").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: uuid("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * JobFunction — the questionnaire/recommendation taxonomy (D10). Work
 * packages and components attach to job functions; the questionnaire maps
 * structured answers to a `resolved_job_function_key` (A5) which drives
 * package recommendation (guide 00 §5.1 `questionNodeSchema.signals.job_functions`).
 */
export const jobFunctionTable = pgTable(
  "job_function",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    functionFamily: text("function_family").notNull(),
    industryProfile: text("industry_profile").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    headcountWeight: integer("headcount_weight").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("job_function_tenant_id_key_uq").on(table.tenantId, table.key)],
);

/**
 * ComponentJobFunction — many-to-many junction (which components serve which
 * job functions, for recommendation/gap analysis). Carries `tenant_id`
 * despite being a junction table, matching the repo's existing junction
 * convention (see `userRoleTable`, packages/db/src/schema/identity.ts) —
 * every table is tenant-scoped except the documented `component_blob`
 * exemption above (guide 00 §3.1).
 */
export const componentJobFunctionTable = pgTable(
  "component_job_function",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    componentId: uuid("component_id").notNull().references(() => componentTable.id),
    jobFunctionId: uuid("job_function_id").notNull().references(() => jobFunctionTable.id),
  },
  (table) => [
    primaryKey({ columns: [table.componentId, table.jobFunctionId] }),
  ],
);

/** WorkPackageJobFunction — many-to-many junction (which packages serve which
 *  job functions). See `componentJobFunctionTable` doc comment re: tenant_id. */
export const workPackageJobFunctionTable = pgTable(
  "work_package_job_function",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    packageId: uuid("package_id").notNull(), // FK to work_package.id (packages/db/src/schema/catalog.ts)
    jobFunctionId: uuid("job_function_id").notNull().references(() => jobFunctionTable.id),
  },
  (table) => [
    primaryKey({ columns: [table.packageId, table.jobFunctionId] }),
  ],
);

/** DiscoverySource — an external feed candidate components are pulled from
 *  (MCP registry, git index, HTTP index, marketplace). `auth_ref` is an
 *  opaque vault reference, never a credential (Invariant 4). */
export const discoverySourceTable = pgTable("discovery_source", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  kind: discoverySourceKindEnum("kind").notNull(),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull(),
  authRef: text("auth_ref"),
  enabled: boolean("enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * DiscoveryCandidate — an external component observed by a discovery source,
 * pending triage. `promoted_component_id` is set once a scope-admin promotes
 * the candidate into the real Component Registry (`status = 'promoted'`);
 * `raw_manifest` is the as-fetched (unverified) manifest — never trusted
 * until promotion re-validates it (guardrails/artifact-integrity).
 */
export const discoveryCandidateTable = pgTable(
  "discovery_candidate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    sourceId: uuid("source_id").notNull().references(() => discoverySourceTable.id),
    externalRef: text("external_ref").notNull(),
    proposedKind: componentKindEnum("proposed_kind").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rawManifest: jsonb("raw_manifest").$type<Record<string, unknown>>().notNull().default({}),
    status: discoveryCandidateStatusEnum("status").notNull().default("new"),
    promotedComponentId: uuid("promoted_component_id").references(() => componentTable.id),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("discovery_candidate_source_id_external_ref_uq").on(table.sourceId, table.externalRef),
  ],
);
