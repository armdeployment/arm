/**
 * Telemetry + health tests (spec §9 1.0).
 */

import { describe, it, expect } from "vitest";
import { initTelemetry, getHealth } from "../src/index.js";

describe("initTelemetry", () => {
  it("returns active=false in dev (no OTLP endpoint configured)", () => {
    const state = initTelemetry("test-service");
    // In test environment, OTEL_EXPORTER_OTLP_ENDPOINT is not set
    expect(state.active).toBe(false);
  });

  it("does not throw when endpoint is absent", () => {
    expect(() => initTelemetry("any-service")).not.toThrow();
  });
});

describe("getHealth", () => {
  it("returns a valid health snapshot", () => {
    const health = getHealth("control-plane", false);
    expect(health.status).toBe("ok");
    expect(health.service).toBe("control-plane");
    expect(health.telemetry).toBe("disabled");
    expect(health.timestamp).toBeTruthy();
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("reports telemetry active when state.active is true", () => {
    const health = getHealth("data-plane-proxy", true);
    expect(health.telemetry).toBe("active");
  });

  it("includes placeholder metrics for pipeline + cache freshness", () => {
    const health = getHealth("control-plane", false);
    // These are 0 until meter-agent and data plane report them (lands 1.2)
    expect(health.eventPipelineLagMs).toBe(0);
    expect(health.policyCacheAgeSeconds).toBe(0);
  });
});
