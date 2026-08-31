/**
 * Real Postgres client (Wave 3 DB wiring, docs/solutions/2026-08-21-
 * d10-adoption-first-restructure.md §8 / docs/solutions/2026-08-24-
 * wave3-adoption-router-db-wiring.md's "next slice").
 *
 * Lazy singleton — the first caller to need a connection creates it; every
 * router sharing the same process reuses it. `closeDb()` exists for tests
 * and scripts that need a clean shutdown (a live `postgres` connection
 * pool otherwise keeps the process alive).
 */

import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { config } from "@arm/config";
import * as schema from "./schema/index.js";

type Db = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: Db | null = null;

/** Throws if DATABASE_URL isn't configured — callers already gate on
 *  ARM_FIXTURE_MODE before reaching here, so this should never fire in
 *  practice; it exists so a misconfigured deployment fails loud, not with a
 *  confusing downstream connection error. */
export function getDb(): Db {
  if (!config.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured (packages/config) — cannot create a Postgres client.",
    );
  }
  if (!dbClient) {
    sqlClient = postgres(config.DATABASE_URL);
    dbClient = drizzle(sqlClient, { schema });
  }
  return dbClient;
}

/** Closes the pooled connection. Idempotent. Tests/scripts only — routers
 *  never call this (the process owns the connection for its lifetime). */
export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbClient = null;
  }
}
