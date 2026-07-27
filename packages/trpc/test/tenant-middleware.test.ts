/**
 * tRPC router tests — focus on the tenant middleware (Invariant §11.6).
 *
 * Verifies:
 *   - Unauthenticated requests are rejected (no tenant context = UNAUTHORIZED).
 *   - Authenticated requests get tenantId stamped into context.
 *   - Input validation (zod) works on procedures.
 *
 * Full DB-query tests land when Postgres is wired (integration tests).
 * These test the contract boundary: auth → middleware → procedure shape.
 */

import { describe, it, expect } from "vitest";
import { createContext, appRouter, type AppRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";

// tRPC caller for testing without an HTTP layer.
// In tRPC v11, callers are created directly from the router.

const authedClaims: ARMClaims = {
  sub: "user_01",
  tenant_id: "tn_01",
  email: "eng@acme.com",
};

function makeCaller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

describe("tenant middleware (Invariant §11.6)", () => {
  it("REJECTS unauthenticated requests to protected procedures", async () => {
    const caller = makeCaller(null);
    await expect(caller.agents.list({ status: "active" })).rejects.toThrowError(
      /No authenticated tenant context/,
    );
  });

  it("REJECTS when claims present but tenant_id missing", async () => {
    const caller = makeCaller({ sub: "u1" } as ARMClaims);
    await expect(caller.agents.list({})).rejects.toThrowError(/No authenticated tenant context/);
  });

  it("ALLOWS authenticated requests with tenant context", async () => {
    const caller = makeCaller(authedClaims);
    const result = await caller.agents.list({ status: "active" });
    expect(result.tenantId).toBe("tn_01");
  });

  it("stamps tenantId into every procedure context", async () => {
    const caller = makeCaller(authedClaims);
    const spend = await caller.spend.summary();
    expect(spend.tenantId).toBe("tn_01");
  });
});

describe("public procedures (no auth required)", () => {
  it("health check works without auth", async () => {
    const caller = makeCaller(null);
    const result = await caller.health.check();
    expect(result.status).toBe("ok");
  });
});

describe("input validation (zod)", () => {
  it("rejects invalid agent creation input", async () => {
    const caller = makeCaller(authedClaims);
    await expect(
      caller.agents.create({
        // Missing required fields intentionally.
        name: "",
        scopeType: "org",
        scopeId: "not-a-uuid",
        stakeholderUserId: "also-not-uuid",
        type: "test",
      }),
    ).rejects.toThrow();
  });
});
