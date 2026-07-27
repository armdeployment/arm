/**
 * ARM configuration + environment validation + telemetry (spec §10, §15, §9 1.0).
 *
 * Centralized env parsing via zod. Every service imports `config` to get a
 * validated, typed config object — no raw `process.env` reads scattered
 * across the codebase.
 *
 * Telemetry baseline (spec §9 1.0): OTel contract defined; SDK init deferred
 * to infra provisioning. The health surface is live from day one.
 *
 * `packages/config` may import from `packages/proto` only (AGENTS.md DAG).
 */

import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

function loadConfig() {
  const parsed = z
    .object({
      NODE_ENV: nodeEnvSchema.default("development"),
      DATABASE_URL: z.string().url().optional(),
      CLICKHOUSE_URL: z.string().url().optional(),
      ARM_OIDC_ISSUER_URL: z.string().url().optional(),
      ARM_OIDC_AUDIENCE: z.string().optional(),
      PROXY_PORT: z.coerce.number().int().positive().default(8787),
      METER_AGENT_BUFFER_DIR: z.string().default("./.meter-buffer"),
      METER_AGENT_BUFFER_MAX_BYTES: z.coerce.number().int().positive().default(1_073_741_024),
      METER_AGENT_BUFFER_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
      OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
      ARM_FAIL_MODE: z.enum(["fail_open", "fail_closed"]).default("fail_closed"),
    })
    .readonly()
    .parse(process.env);
  return parsed;
}

export const config = loadConfig();
export type AppConfig = typeof config;
export const isProduction = config.NODE_ENV === "production";
export const isDevelopment = config.NODE_ENV === "development";

// ── Telemetry (spec §9 1.0) ────────────────────────────────────────────────

export interface ServiceHealth {
  status: "ok" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  telemetry: "active" | "disabled";
  eventPipelineLagMs: number;
  policyCacheAgeSeconds: number;
}

const startTime = Date.now();
const SERVICE_VERSION = "0.0.0";

export function initTelemetry(serviceName: string): { active: boolean } {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return { active: false };
  }
  console.debug(
    `[telemetry] ${serviceName}: OTLP endpoint configured, SDK start deferred to infra provisioning`,
  );
  return { active: true };
}

export function getHealth(serviceName: string, telemetryActive: boolean): ServiceHealth {
  return {
    status: "ok",
    service: serviceName,
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    telemetry: telemetryActive ? "active" : "disabled",
    eventPipelineLagMs: 0,
    policyCacheAgeSeconds: 0,
  };
}
