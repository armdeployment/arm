/**
 * Org-tree mutation audit log (D8).
 *
 * Every org-node create / rename / reparent / delete is recorded here. This is
 * control-plane metadata only (Invariant 1) — it records WHO restructured the
 * tree, not any resource content or prompt bodies.
 *
 * Powered by the org-node permission verbs (packages/auth); every entry
 * corresponds to a successful `org_node:*` authorization.
 */

import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { tenantTable } from "./org-tree.js";
import { userTable } from "./identity.js";

/** D8 org-node mutation verbs (mirrors packages/auth ORG_NODE_PERMISSIONS). */
export const orgMutationVerbEnum = ["create", "rename", "reparent", "delete"] as const;

export const orgMutationLogTable = pgTable("org_mutation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantTable.id),

  /** Who performed the mutation (always a human — Invariant 7). */
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => userTable.id),

  /** Which verb: create | rename | reparent | delete. */
  verb: text("verb").$type<(typeof orgMutationVerbEnum)[number]>().notNull(),

  /** The node that was the target of the mutation. */
  nodeId: uuid("node_id").notNull(),
  nodeName: text("node_name").notNull(),
  nodeType: text("node_type").notNull(),

  /** For reparent: the old + new parent ids (null = root). */
  oldParentId: uuid("old_parent_id"),
  newParentId: uuid("new_parent_id"),

  /** For create/rename: the new name. For delete: the name at time of deletion. */
  newName: text("new_name"),

  /** Free-text reason the actor supplied (optional, shown in audit trail). */
  reason: text("reason"),

  /** Snapshot of the resolved roles that authorized this mutation (forensics). */
  authSnapshot: jsonb("auth_snapshot"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
