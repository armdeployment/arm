/**
 * Work-type usage classification tables (D7).
 *
 * Per-department / per-plant taxonomy presets + custom labels, the substrate
 * for the per-prompt work-type tag emitted on every `token_usage_event`.
 *
 * The governing rule (D7 §c, following D6): presets set defaults, they never
 * gate capabilities. A WorkTypeTaxonomy row is a per-scope label set —
 * `tenant_id`-scoped like every multi-tenant table (Invariant 6), pointing at
 * an org-tree node of `scope_type` (the agent's department / plant / etc.).
 *
 * Every WorkTypeTaxonomy row references an existing org-tree node (validated by
 * the `guardrails/taxonomy-scope` check). Custom labels extend the preset set;
 * label renames trigger async re-labeling of the trailing window
 * (`classifier_version` guards it).
 */

import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { scopeTypeEnum } from "./enums.js";
import { tenantTable } from "./org-tree.js";

/**
 * WorkTypeTaxonomy — per-scope label set for work-type classification (D7).
 *
 * One row per (tenant, scope) carries the label list the classifier picks
 * from. Preset label sets are copy-on-provisioning (edits don't mutate the
 * shared preset); custom labels are admin-managed per scope.
 */
export const workTypeTaxonomyTable = pgTable("work_type_taxonomy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),
  /** Scope anchor — the agent's department / plant / workstream (§6.1). */
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  /** Human-readable name for this taxonomy (e.g. "Engineering"). */
  name: text("name").notNull(),
  /** Ordered primary labels the classifier picks from. NULL = `unknown`. */
  labels: jsonb("labels").$type<string[]>().notNull().default([]),
  /**
   * Optional secondary tag presets (structural, e.g.
   * ["tool:web_search", "model:claude-sonnet"]). Secondary tags are ≤5 per
   * prompt (sub-decision D7.s1).
   */
  secondaryTagPresets: jsonb("secondary_tag_presets").$type<string[]>().notNull().default([]),
  /** Monotonic version — incremented on label edits to guard re-labeling. */
  classifierVersion: text("classifier_version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
