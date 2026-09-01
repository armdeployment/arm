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
      // ── OIDC SSO (see packages/auth/src/index.ts, docs/sso-setup.md) ──
      // All three of issuer/JWKS/audience must be set together; any one of
      // them alone is a misconfiguration, and `resolveAuthMode` says so
      // rather than half-enabling verification.
      ARM_OIDC_ISSUER_URL: z.string().url().optional(),
      ARM_OIDC_JWKS_URL: z.string().url().optional(),
      ARM_OIDC_AUDIENCE: z.string().optional(),
      /**
       * Which token claim carries the ARM tenant. Enterprise IdPs do not mint
       * a `tenant_id` claim unless someone configures one, so the common
       * single-tenant deployment sets ARM_OIDC_TENANT_ID instead and leaves
       * this alone.
       */
      ARM_OIDC_TENANT_CLAIM: z.string().default("tenant_id"),
      /** Tenant every verified user belongs to, when the token carries none. */
      ARM_OIDC_TENANT_ID: z.string().optional(),
      /** Claim carrying the user's email. Entra/Okta/Google all use `email`. */
      ARM_OIDC_EMAIL_CLAIM: z.string().default("email"),
      /**
       * Serve the built-in development identity even under NODE_ENV=production.
       * Without OIDC configured, production otherwise refuses every request
       * rather than silently authenticating everyone as the same fixed user.
       * The sandbox sets this deliberately; nothing else should.
       */
      ARM_ALLOW_DEV_IDENTITY: z
        .enum(["0", "1"])
        .default("0")
        .transform((v) => v === "1"),
      PROXY_PORT: z.coerce.number().int().positive().default(8787),
      /** Where the proxy persists today's quota consumption across restarts. */
      PROXY_QUOTA_STATE_DIR: z.string().default("./.arm-proxy-state"),
      METER_AGENT_BUFFER_DIR: z.string().default("./.meter-buffer"),
      METER_AGENT_BUFFER_MAX_BYTES: z.coerce.number().int().positive().default(1_073_741_024),
      METER_AGENT_BUFFER_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
      METER_AGENT_PORT: z.coerce.number().int().positive().default(8789),
      /** Where the proxy ships metering events. Unset = buffer locally only. */
      METER_AGENT_URL: z.string().url().optional(),
      METER_AGENT_FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
      /**
       * Control plane the meter-agent flushes to. Unset = the agent buffers
       * and never drains, which it reports as `degraded` rather than `ok`.
       */
      ARM_CONTROL_PLANE_URL: z.string().url().optional(),
      /**
       * Shared secret the data plane presents to the control plane's metering
       * ingest endpoint. The spec's answer is mTLS; this is the in-application
       * equivalent for deployments that terminate TLS at an ingress. Ingest
       * refuses under NODE_ENV=production when unset — an open ingest endpoint
       * lets anyone forge another tenant's spend.
       */
      ARM_INGEST_TOKEN: z.string().optional(),
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
