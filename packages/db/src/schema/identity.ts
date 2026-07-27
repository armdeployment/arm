/**
 * Users, roles, and agents (spec §4.1, §6.6).
 *
 * Invariants enforced here at the schema level:
 *   - §11.7: every Agent has exactly ONE accountable human stakeholder.
 *            `stakeholderUserId` is NOT NULL. ownerUserId may be NULL for
 *            scope-owned (auto-spawned) agents; stakeholder is NEVER NULL.
 *   - §11.8: priorityTier defaults to 'standard'; elevated tiers require
 *            scope-admin approval (enforced at the policy layer, §6.6).
 *   - §11.2: Agent.id 1:1 Agent.subAccountId — two stable IDs for the same agent.
 */

import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import {
  organizationTable,
  tenantTable,
} from "./org-tree.js";
import {
  priorityTierEnum,
  spawnedByEnum,
  agentStatusEnum,
  scopeTypeEnum,
} from "./enums.js";

/** User — a human in the tenant. */
export const userTable = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  orgId: uuid("org_id").notNull().references(() => organizationTable.id),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Role — a named permission bundle attached to a scope node.
 * `scopeType` + `scopeId` is the polymorphic anchor (scope_id FKs are validated
 * at the policy layer, not by a single FK constraint — different scope types
 * point at different org-tree tables).
 */
export const roleTable = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  name: text("name").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** UserRole junction (many-to-many; preserves referential integrity). */
export const userRoleTable = pgTable(
  "user_role",
  {
    userId: uuid("user_id").notNull().references(() => userTable.id),
    roleId: uuid("role_id").notNull().references(() => roleTable.id),
    tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: uniqueIndex("user_role_pk").on(t.userId, t.roleId) }),
);

/**
 * Agent — the governed identity (§6.6).
 *
 * `ownerUserId` is NULL for scope-owned agents (auto-spawned by automation/templates);
 * `stakeholderUserId` is ALWAYS set — no anonymous automation (Invariant 7).
 */
export const agentTable = pgTable("agent", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),

  // Accountability: owner may be NULL (scope-owned); stakeholder is NEVER NULL.
  ownerUserId: uuid("owner_user_id").references(() => userTable.id),
  stakeholderUserId: uuid("stakeholder_user_id")
    .notNull()
    .references(() => userTable.id),

  // Scope attachment (polymorphic): points at an org-tree node of scopeType.
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  // Cross-cutting reporting dimension, NOT a tree level (spec §4.1 comment).
  projectTag: text("project_tag"),

  type: text("type").notNull(), // opencode / claude code / copilot / pi / custom
  status: agentStatusEnum("status").notNull().default("active"),

  // Priority tier — policy, not self-declared (Invariant 8).
  priorityTier: priorityTierEnum("priority_tier").notNull().default("standard"),
  spawnedBy: spawnedByEnum("spawned_by").notNull(),

  // 1:1 link to SubAccount (Invariant 2). Two stable IDs for the same agent.
  subAccountId: uuid("sub_account_id").notNull().unique(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * SubAccount — the LLM/metering-side identity (spec §4.1).
 *
 * Paired 1:1 with Agent (Invariant 2): analytics joins use agent_id, which is
 * present in both event tables. `userId` NULL when the sub-account belongs to a
 * scope-owned agent.
 */
export const subAccountTable = pgTable("sub_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  userId: uuid("user_id").references(() => userTable.id),
  agentId: uuid("agent_id").notNull().references(() => agentTable.id),
  apiKeyHash: text("api_key_hash").notNull(),
  allowedModels: jsonb("allowed_models").$type<string[]>().notNull().default([]),
  quotasJson: jsonb("quotas_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** DelegateKey — per-tenant provider key for attribution + enforcement (§7.2). */
export const delegateKeyTable = pgTable("delegate_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  provider: text("provider").notNull(), // anthropic | openai | ...
  keyRef: text("key_ref").notNull(), // opaque reference to vaulted key, never the key itself
  rotatedAt: timestamp("rotated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
