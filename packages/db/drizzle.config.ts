import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. DATABASE_URL is read at migration/push time, not import time,
 * so `pnpm db:generate` (which only needs the schema) works without a live DB.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/arm",
  },
  strict: true,
  verbose: true,
});
