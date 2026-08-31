/**
 * Models, budgets, and LLM policy (spec §4.1).
 */

import { pgTable, uuid, text, numeric, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { modelKindEnum, scopeTypeEnum } from "./enums.js";
import { tenantTable } from "./org-tree.js";

/** Model — an LLM an agent may use. `kind` drives the DLP gate (§6.5). */
export const modelTable = pgTable("model", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  kind: modelKindEnum("kind").notNull(),
  listPriceIn: numeric("list_price_in", { precision: 18, scale: 8 }),
  listPriceOut: numeric("list_price_out", { precision: 18, scale: 8 }),
  internalPriceIn: numeric("internal_price_in", { precision: 18, scale: 8 }),
  internalPriceOut: numeric("internal_price_out", { precision: 18, scale: 8 }),
  contextWindow: integer("context_window"),
  hostedEndpoint: text("hosted_endpoint"), // NULL for closed models
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Budget — USD cap + model allocations + priority reservations, attached to a scope node.
 *
 * `priorityReservationsJson` holds e.g.
 *   { "critical_reserve_pct": 20, "background_floor_pct": 5 }
 * The starvation guard (§6.6) reads `background_floor_pct`.
 */
export const budgetTable = pgTable("budget", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  period: text("period").notNull(), // e.g. "monthly:2026-07" (resolution left to policy layer)
  usdCap: numeric("usd_cap", { precision: 18, scale: 4 }).notNull(),
  modelAllocationsJson: jsonb("model_allocations_json").$type<Record<string, unknown>>(),
  priorityReservationsJson: jsonb("priority_reservations_json").$type<Record<string, number>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * LLMPolicy — which models a scope may use, downgrade target, per-agent day cap.
 *
 * `perPriorityCapsJson` holds e.g.
 *   { "background": { "day_cap_usd": 50, "models": ["self_hosted/*"] } }
 */
export const llmPolicyTable = pgTable("llm_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  allowedModels: jsonb("allowed_models").$type<string[]>().notNull().default([]),
  autoDowngradeTo: text("auto_downgrade_to"),
  perAgentDayCap: numeric("per_agent_day_cap", { precision: 18, scale: 4 }),
  approvalRequiredFor: jsonb("approval_required_for").$type<string[]>().notNull().default([]),
  perPriorityCapsJson: jsonb("per_priority_caps_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
