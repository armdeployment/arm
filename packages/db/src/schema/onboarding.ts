/**
 * Onboarding — questionnaire → recommendation → setup token (D10, guide 00
 * §3.2, docs/solutions/2026-08-21-d10-adoption-first-restructure.md).
 *
 * Adoption-first: a structured questionnaire (no free text — A5, Invariant 1)
 * resolves a job function and recommends work-package versions; approved
 * recommendations (or an approver's sign-off, A6) become a signed setup
 * token the ARM client redeems once to install + activate (A4 — one signed
 * generic client + a per-user signed setup token, never a per-user compiled
 * binary).
 *
 * NOTE (contracts / Wave 0): shape only. Filled in by `client` (Wave 1) per
 * docs/guides/03-client-downloader.md.
 */

import { pgTable, uuid, text, jsonb, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { questionnaireStatusEnum, industryProfileEnum } from "./enums.js";
import { tenantTable } from "./org-tree.js";
import { userTable } from "./identity.js";

/**
 * QuestionnaireDefinition — a versioned graph of the onboarding questionnaire
 * (guide 00 §5.1 `questionnaireGraphSchema`). `graph` is the wire-shaped
 * question DAG; `industry_profile` selects the default graph for a tenant's
 * provisioning profile (D6) — a default source only, never branched on at
 * runtime (no-profile-branching).
 */
export const questionnaireDefinitionTable = pgTable(
  "questionnaire_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantTable.id),
    version: integer("version").notNull().default(1),
    industryProfile: industryProfileEnum("industry_profile").notNull(),
    graph: jsonb("graph").$type<Record<string, unknown>>().notNull(),
    status: questionnaireStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("questionnaire_definition_tenant_id_version_uq").on(table.tenantId, table.version),
  ],
);

/**
 * QuestionnaireResponse — a completed (or in-progress) run through a
 * questionnaire definition. `answers` is STRUCTURED ONLY — no free text ever
 * reaches the control plane (A5, Invariant 1; enforced by the proto
 * `questionnaireAnswerSchema` shape + the `no-content-in-activation` guardrail).
 * `definition_version` denormalizes the definition's version at answer time
 * (immutable snapshot — a later republish of the definition must not change
 * what an already-recommended response resolved against).
 */
export const questionnaireResponseTable = pgTable("questionnaire_response", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  definitionVersion: integer("definition_version").notNull(),
  userId: uuid("user_id").references(() => userTable.id),
  orgNodeId: uuid("org_node_id"),
  /** Structured answers only (A5) — z.record of string|string[]|number|boolean values. */
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
  resolvedJobFunctionKey: text("resolved_job_function_key"),
  recommendedPackageVersionIds: jsonb("recommended_package_version_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * SetupToken — a per-user signed setup token (A4). Stores a **hash** of the
 * token, never the token itself (Invariant 4: short-lived credentials
 * everywhere credentials are minted — the same discipline extends to
 * anything that authorizes install/activation). `id` doubles as the JWT
 * `jti` (`setupTokenClaimsSchema.jti`, guide 00 §5.2). `activation_code` is a
 * short, human-relayable code (6 chars) unique per tenant, used for the
 * out-of-band "type this code" redemption path.
 */
export const setupTokenTable = pgTable(
  "setup_token",
  {
    id: uuid("id").primaryKey().defaultRandom(), // = jti
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantTable.id),
    /** sha256 of the signed token — the token itself is NEVER stored (Invariant 4). */
    tokenSha256: text("token_sha256").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id),
    packageVersionIds: jsonb("package_version_ids").$type<string[]>().notNull().default([]),
    /** sha256 of the connections manifest this token was issued against. */
    connectionsDigest: text("connections_digest").notNull(),
    activationCode: text("activation_code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedClientVersion: text("redeemed_client_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("setup_token_tenant_id_activation_code_uq").on(
      table.tenantId,
      table.activationCode,
    ),
  ],
);
