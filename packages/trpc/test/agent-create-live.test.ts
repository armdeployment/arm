/**
 * agents.create against real Postgres.
 *
 * This procedure used to return a hardcoded `id: "agt_new"` for an agent that
 * was never created. Implementing it for real needed a schema change —
 * `agent` had no `name` column, so the name the procedure takes had nowhere
 * to go — and it is two inserts, not one: Invariant 2 pairs every Agent 1:1
 * with a SubAccount, whose `api_key_hash` is NOT NULL.
 *
 * Skips without DATABASE_URL, like every other live-database suite here.
 * Seeds only the rows the foreign keys demand, and cleans up after itself so
 * it is idempotent against the persistent dev database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { ARMClaims } from "@arm/auth";
import { appRouter, createContext } from "../src/index.js";

const REAL_TENANT = "d9d9d9d9-0000-4000-8000-000000000001";
const STAKEHOLDER = randomUUID();
const SCOPE_ID = randomUUID();
const ORG_ID = randomUUID();
const claims: ARMClaims = { sub: STAKEHOLDER, tenant_id: REAL_TENANT, email: "mgr@acme.com" };
const caller = () => appRouter.createCaller(createContext({ claims }));

const createdAgentIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("agents.create — live Postgres", () => {
  beforeAll(async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const { getDb, tenantTable, organizationTable, userTable } = await import("@arm/db");
    const db = getDb();
    await db.insert(tenantTable).values({ id: REAL_TENANT, name: "Acme" }).onConflictDoNothing();
    // `user.org_id` is NOT NULL and references organization.
    await db
      .insert(organizationTable)
      .values({ id: ORG_ID, tenantId: REAL_TENANT, name: "Acme Manufacturing" })
      .onConflictDoNothing();
    await db
      .insert(userTable)
      .values({
        id: STAKEHOLDER,
        tenantId: REAL_TENANT,
        orgId: ORG_ID,
        email: `${STAKEHOLDER}@acme.com`,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    const { getDb, agentTable, subAccountTable, userTable } = await import("@arm/db");
    const { inArray, eq } = await import("drizzle-orm");
    const db = getDb();
    if (createdAgentIds.length > 0) {
      // sub_account first — it holds the FK to agent.
      await db.delete(subAccountTable).where(inArray(subAccountTable.agentId, createdAgentIds));
      await db.delete(agentTable).where(inArray(agentTable.id, createdAgentIds));
    }
    await db.delete(userTable).where(eq(userTable.id, STAKEHOLDER));
    const { organizationTable } = await import("@arm/db");
    await db.delete(organizationTable).where(eq(organizationTable.id, ORG_ID));
    delete process.env.ARM_FIXTURE_MODE;
  });

  const input = {
    name: "line-monitor-real",
    scopeType: "department" as const,
    scopeId: SCOPE_ID,
    stakeholderUserId: STAKEHOLDER,
    type: "claude code",
    priorityTier: "standard" as const,
  };

  it("writes an agent whose name actually persists", async () => {
    const created = await caller().agents.create(input);
    createdAgentIds.push(created.id);
    expect(created.id).not.toBe("agt_new");

    const { getDb, agentTable } = await import("@arm/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await getDb().select().from(agentTable).where(eq(agentTable.id, created.id));
    expect(row!.name).toBe("line-monitor-real");
    expect(row!.tenantId).toBe(REAL_TENANT);
  });

  it("pairs it 1:1 with a SubAccount, in both directions (Invariant 2)", async () => {
    const created = await caller().agents.create({ ...input, name: "paired" });
    createdAgentIds.push(created.id);

    const { getDb, agentTable, subAccountTable } = await import("@arm/db");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const [agent] = await db.select().from(agentTable).where(eq(agentTable.id, created.id));
    const [sa] = await db
      .select()
      .from(subAccountTable)
      .where(eq(subAccountTable.id, created.subAccountId));

    expect(agent!.subAccountId).toBe(created.subAccountId);
    expect(sa!.agentId).toBe(created.id);
  });

  it("NEVER stores the raw API key — only its sha256 (Invariant 4)", async () => {
    const created = await caller().agents.create({ ...input, name: "keyed" });
    createdAgentIds.push(created.id);

    const { getDb, subAccountTable } = await import("@arm/db");
    const { eq } = await import("drizzle-orm");
    const [sa] = await getDb()
      .select()
      .from(subAccountTable)
      .where(eq(subAccountTable.id, created.subAccountId));

    expect(created.apiKey).toMatch(/^arm_sk_/);
    expect(JSON.stringify(sa)).not.toContain(created.apiKey);
    expect(sa!.apiKeyHash).toBe(createHash("sha256").update(created.apiKey, "utf8").digest("hex"));
  });

  it("gives every agent a distinct key and sub-account", async () => {
    const a = await caller().agents.create({ ...input, name: "a" });
    const b = await caller().agents.create({ ...input, name: "b" });
    createdAgentIds.push(a.id, b.id);
    expect(a.apiKey).not.toBe(b.apiKey);
    expect(a.subAccountId).not.toBe(b.subAccountId);
  });

  it("writes neither row when the transaction cannot complete", async () => {
    // A stakeholder that violates the foreign key. Both inserts are in one
    // transaction, so a failure must leave no orphaned agent behind.
    const { getDb, agentTable } = await import("@arm/db");
    const { eq } = await import("drizzle-orm");
    const orphanName = `orphan-${randomUUID().slice(0, 8)}`;
    await expect(
      caller().agents.create({ ...input, name: orphanName, stakeholderUserId: randomUUID() }),
    ).rejects.toThrow();

    const rows = await getDb().select().from(agentTable).where(eq(agentTable.name, orphanName));
    expect(rows).toHaveLength(0);
  });
});
