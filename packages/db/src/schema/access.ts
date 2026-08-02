/**
 * Resource access domain (spec §4.1 resource block, §6).
 *
 * Invariant 3 (higher-level deny always wins) is enforced by the policy RESOLVER,
 * not by schema constraints. Schema here just stores the grant rows the resolver
 * consumes; see docs/permission-rules.md and packages/policy.
 */

import { pgTable, uuid, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import {
  resourceTypeEnum,
  vendingStrategyEnum,
  principalTypeEnum,
  scopeTypeEnum,
  accessRequestStatusEnum,
  approvalDecisionEnum,
} from "./enums.js";
import { agentTable, userTable } from "./identity.js";
import { tenantTable } from "./org-tree.js";

/** Resource — a governed external asset (S3 bucket, DB, SharePoint site, …). */
export const resourceTable = pgTable("resource", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  type: resourceTypeEnum("type").notNull(),
  connectorId: uuid("connector_id").notNull().references(() => resourceConnectorTable.id),
  externalRef: text("external_ref").notNull(),
  classification: text("classification").notNull(), // FK-by-value to ClassificationLevel.name
  tagsJson: jsonb("tags_json").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** ResourceConnector — how a resource type is reached (spec §6.2). */
export const resourceConnectorTable = pgTable("resource_connector", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  type: resourceTypeEnum("type").notNull(),
  authMechanism: text("auth_mechanism").notNull(),
  vendingStrategy: vendingStrategyEnum("vending_strategy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** ResourceRole — named action bundle attachable to resources. */
export const resourceRoleTable = pgTable("resource_role", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  name: text("name").notNull(),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PermissionGrant — a (principal × resource) grant with actions + constraints.
 *
 * Constraints carry things like `{ "prefix": "/{team}/" }` for S3 prefix scoping.
 * `expiresAt` NULL = does not expire (JIT grants set a short TTL, §6.4).
 */
export const permissionGrantTable = pgTable("permission_grant", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  principalType: principalTypeEnum("principal_type").notNull(),
  principalId: uuid("principal_id").notNull(),
  scopeType: scopeTypeEnum("scope_type"), // optional scope anchoring for inheritance resolution
  scopeId: uuid("scope_id"),
  resourceId: uuid("resource_id").notNull().references(() => resourceTable.id),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  // `deny: true` marks this row as an explicit deny (Inheritance chain, §6.1).
  deny: jsonb("deny").$type<boolean>().notNull().default(false),
  constraintsJson: jsonb("constraints_json").$type<Record<string, unknown>>(),
  grantedBy: uuid("granted_by").notNull().references(() => userTable.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/**
 * ClassificationLevel — ordered sensitivity rank for DLP gating (§6.5).
 * Dual-axis classification (D6): sensitivity rank + regulatory flags (ITAR/EAR/GxP).
 * The regulatory axis is a manufacturing capability — any tenant can enable it.
 */
export const classificationLevelTable = pgTable("classification_level", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  rank: integer("rank").notNull(),
  name: text("name").notNull().unique(), // public, internal, confidential, restricted
  /** Regulatory flags for dual-axis classification (D6). Empty array = single-axis. */
  regulatoryFlags: jsonb("regulatory_flags").$type<string[]>().notNull().default([]),
});

/** AccessRequest — JIT elevation request (§6.4). */
export const accessRequestTable = pgTable("access_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  requesterAgentId: uuid("requester_agent_id").notNull().references(() => agentTable.id),
  resourceId: uuid("resource_id").notNull().references(() => resourceTable.id),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  reason: text("reason"),
  status: accessRequestStatusEnum("status").notNull().default("pending"),
  approverId: uuid("approver_id").references(() => userTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/** AccessApproval — decision record for an AccessRequest. */
export const accessApprovalTable = pgTable("access_approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  requestId: uuid("request_id").notNull().references(() => accessRequestTable.id),
  approverId: uuid("approver_id").notNull().references(() => userTable.id),
  decision: approvalDecisionEnum("decision").notNull(),
  conditionsJson: jsonb("conditions_json").$type<Record<string, unknown>>(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});
