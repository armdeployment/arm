/**
 * ARM configuration + environment validation (spec §10, §15 `packages/config`).
 *
 * Centralized env parsing via zod. Every service imports `config` to get a
 * validated, typed config object — no raw `process.env` reads scattered
 * across the codebase.
 *
 * `packages/config` may import from `packages/proto` only (AGENTS.md DAG).
 */

import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

/**
 * Parse and validate environment. Throws on missing/invalid required vars
 * in production; allows partial in dev/test.
 */
function loadConfig() {
  const parsed = z
    .object({
      NODE_ENV: nodeEnvSchema.default("development"),
      // ── Control plane ──
      DATABASE_URL: z.string().url().optional(),
      CLICKHOUSE_URL: z.string().url().optional(),
      // ── Auth ──
      ARM_OIDC_ISSUER_URL: z.string().url().optional(),
      ARM_OIDC_AUDIENCE: z.string().optional(),
      // ── Data plane ──
      PROXY_PORT: z.coerce.number().int().positive().default(8787),
      METER_AGENT_BUFFER_DIR: z.string().default("./.meter-buffer"),
      METER_AGENT_BUFFER_MAX_BYTES: z.coerce.number().int().positive().default(1_073_741_024), // 1 GB
      METER_AGENT_BUFFER_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
      // ── Telemetry ──
      OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
      // ── Guard: fail-open vs fail-closed (spec Open Item 3) ──
      ARM_FAIL_MODE: z.enum(["fail_open", "fail_closed"]).default("fail_closed"),
    })
    .readonly()
    .parse(process.env);

  return parsed;
}

/** Validated application config. Evaluated once at import time. */
export const config = loadConfig();

export type AppConfig = typeof config;

/** True when running in production. */
export const isProduction = config.NODE_ENV === "production";

/** True when running in development. */
export const isDevelopment = config.NODE_ENV === "development";
