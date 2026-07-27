/**
 * Tenant + organization tree (spec §4.1, §3.4 / D1-b).
 *
 * Tenant sits ABOVE Organization so one tenant can host several organizations.
 * Self-hosted deployments seed exactly one Tenant row — the schema and guardrails
 * are uniform across SaaS and on-prem.
 */

import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { deploymentEnum } from "./enums.js";

/** Tenant — root of multi-tenancy. Every multi-tenant table FKs here (Invariant 6). */
export const tenantTable = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier"), // commercial tier label, opaque to schema
  deployment: deploymentEnum("deployment").notNull().default("saas"),
  licenseJson: jsonb("license_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Organization — top of the org tree within a tenant. */
export const organizationTable = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  name: text("name").notNull(),
  idpConfig: jsonb("idp_config").$type<Record<string, unknown>>(), // SSO/federation config
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Department. */
export const departmentTable = pgTable("department", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id), // denormalized for mandatory filter (D1-b)
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Group. */
export const groupTable = pgTable("group", {
  id: uuid("id").primaryKey().defaultRandom(),
  deptId: uuid("dept_id").notNull().references(() => departmentTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Team. */
export const teamTable = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groupTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Workstream — lowest authority level in the inheritance chain (§6.1). */
export const workstreamTable = pgTable("workstream", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teamTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenantTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
