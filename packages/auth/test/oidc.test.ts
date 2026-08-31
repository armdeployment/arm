/**
 * OIDC request authentication.
 *
 * The interesting cases are the ones that decide whether a deployment is
 * exposed: what happens with no configuration, with half a configuration, and
 * with a token that does not carry a tenant. Signature verification itself is
 * jose's job and is not re-tested here — `authenticateRequest` takes an
 * injectable `verify` so the mapping and the fail-closed behaviour can be
 * tested without a live JWKS endpoint or a signing key.
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolveAuthMode,
  authenticateRequest,
  bearerToken,
  mapVerifiedPayload,
  type ARMClaims,
  type AuthEnv,
} from "../src/index.js";

const OIDC_ENV: AuthEnv = {
  ARM_OIDC_ISSUER_URL: "https://login.microsoftonline.com/acme/v2.0",
  ARM_OIDC_JWKS_URL: "https://login.microsoftonline.com/acme/discovery/v2.0/keys",
  ARM_OIDC_AUDIENCE: "arm-control-plane",
};

const DEV_IDENTITY: ARMClaims = {
  sub: "60000000-0000-4000-8000-000000000001",
  tenant_id: "d9d9d9d9-0000-4000-8000-000000000001",
  email: "eng@acme.com",
};

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name] ?? h[name.toLowerCase()] ?? null,
});

describe("resolveAuthMode", () => {
  it("verifies when issuer, JWKS and audience are all set", () => {
    const mode = resolveAuthMode(OIDC_ENV);
    expect(mode.kind).toBe("oidc");
    if (mode.kind !== "oidc") throw new Error("unreachable");
    expect(mode.config.audience).toBe("arm-control-plane");
  });

  it("uses the development identity when nothing is configured", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" }).kind).toBe("development");
    expect(resolveAuthMode({}).kind).toBe("development");
  });

  it("REFUSES under NODE_ENV=production with no OIDC configuration", () => {
    // The whole point: a production deploy must not silently authenticate
    // every caller as one fixed user with one fixed tenant.
    const mode = resolveAuthMode({ NODE_ENV: "production" });
    expect(mode.kind).toBe("refuse");
    expect(mode.kind === "refuse" && mode.reason).toContain("ARM_OIDC_ISSUER_URL");
  });

  it("REFUSES a half-configured verifier, naming what is missing", () => {
    const mode = resolveAuthMode({ ARM_OIDC_ISSUER_URL: OIDC_ENV.ARM_OIDC_ISSUER_URL });
    expect(mode.kind).toBe("refuse");
    if (mode.kind !== "refuse") throw new Error("unreachable");
    expect(mode.reason).toContain("ARM_OIDC_JWKS_URL");
    expect(mode.reason).toContain("ARM_OIDC_AUDIENCE");
    expect(mode.reason).not.toContain("ARM_OIDC_ISSUER_URL,");
  });

  it("allows the dev identity in production only when explicitly opted in", () => {
    const mode = resolveAuthMode({ NODE_ENV: "production", ARM_ALLOW_DEV_IDENTITY: true });
    expect(mode.kind).toBe("development");
    expect(mode.kind === "development" && mode.reason).toContain("one fixed identity");
  });

  it("carries the tenant mapping through to the verifier config", () => {
    const mode = resolveAuthMode({
      ...OIDC_ENV,
      ARM_OIDC_TENANT_ID: "tn_acme",
      ARM_OIDC_TENANT_CLAIM: "https://acme.com/tenant",
      ARM_OIDC_EMAIL_CLAIM: "upn",
    });
    if (mode.kind !== "oidc") throw new Error("expected oidc");
    expect(mode.config.fixedTenantId).toBe("tn_acme");
    expect(mode.config.tenantClaim).toBe("https://acme.com/tenant");
    expect(mode.config.emailClaim).toBe("upn");
  });
});

describe("bearerToken", () => {
  it("reads the token regardless of header case", () => {
    expect(bearerToken(headers({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
    expect(bearerToken(headers({ Authorization: "bearer abc.def.ghi" }))).toBe("abc.def.ghi");
  });

  it("returns null for a missing or non-bearer header", () => {
    expect(bearerToken(headers({}))).toBeNull();
    expect(bearerToken(headers({ authorization: "Basic dXNlcjpwdw==" }))).toBeNull();
  });
});

describe("mapVerifiedPayload", () => {
  it("takes the tenant from the configured claim when the token carries one", () => {
    const claims = mapVerifiedPayload({ sub: "u1", tenant_id: "tn_from_token" }, {});
    expect(claims.tenant_id).toBe("tn_from_token");
  });

  it("falls back to the configured fixed tenant — the single-tenant case", () => {
    // No real Okta/Entra/Google token carries a tenant_id claim, so this is
    // the path an actual enterprise deployment takes.
    const claims = mapVerifiedPayload(
      { sub: "u1", email: "eng@acme.com" },
      { fixedTenantId: "tn_acme" },
    );
    expect(claims).toMatchObject({ sub: "u1", tenant_id: "tn_acme", email: "eng@acme.com" });
  });

  it("reads a vendor-namespaced tenant claim when configured", () => {
    const claims = mapVerifiedPayload(
      { sub: "u1", "https://acme.com/tenant": "tn_plant_7" },
      { tenantClaim: "https://acme.com/tenant" },
    );
    expect(claims.tenant_id).toBe("tn_plant_7");
  });

  it("THROWS when a verified token cannot be resolved to a tenant", () => {
    // Verified but unscopeable. Invariant 6 makes an unscoped identity useless,
    // so this fails loudly rather than inventing a tenant.
    expect(() => mapVerifiedPayload({ sub: "u1" }, {})).toThrow(
      /could not be resolved to a tenant/,
    );
  });

  it("carries ARM's own agent-token claims through", () => {
    const claims = mapVerifiedPayload(
      {
        sub: "agt_1",
        tenant_id: "tn_acme",
        agent_id: "agt_1",
        sub_account_id: "sa_agt_1",
        priority_tier: "background",
        scope: "s3:read",
      },
      {},
    );
    expect(claims).toMatchObject({
      agent_id: "agt_1",
      sub_account_id: "sa_agt_1",
      priority_tier: "background",
      scope: "s3:read",
    });
  });
});

describe("authenticateRequest", () => {
  it("returns null in refuse mode, and says why exactly once", async () => {
    const onDiagnostic = vi.fn();
    const claims = await authenticateRequest(
      headers({ authorization: "Bearer whatever" }),
      { kind: "refuse", reason: "no OIDC configuration in production" },
      { developmentIdentity: DEV_IDENTITY, onDiagnostic },
    );
    expect(claims).toBeNull();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });

  it("returns the development identity in development mode", async () => {
    const claims = await authenticateRequest(
      headers({}),
      { kind: "development", reason: "test" },
      { developmentIdentity: DEV_IDENTITY },
    );
    expect(claims).toEqual(DEV_IDENTITY);
  });

  it("returns verified claims in oidc mode", async () => {
    const verified: ARMClaims = { sub: "u1", tenant_id: "tn_acme", email: "eng@acme.com" };
    const verify = vi.fn().mockResolvedValue(verified);
    const claims = await authenticateRequest(
      headers({ authorization: "Bearer good.token" }),
      resolveAuthMode(OIDC_ENV),
      { developmentIdentity: DEV_IDENTITY, verify },
    );
    expect(claims).toEqual(verified);
    expect(verify).toHaveBeenCalledWith(
      "good.token",
      expect.objectContaining({ audience: "arm-control-plane" }),
    );
  });

  it("NEVER falls back to the development identity when a token is rejected", async () => {
    // The failure mode that would matter most: a bad token quietly becoming a
    // valid session as the fixed dev user.
    const onDiagnostic = vi.fn();
    const claims = await authenticateRequest(
      headers({ authorization: "Bearer expired.token" }),
      resolveAuthMode(OIDC_ENV),
      {
        developmentIdentity: DEV_IDENTITY,
        verify: vi.fn().mockRejectedValue(new Error('"exp" claim timestamp check failed')),
        onDiagnostic,
      },
    );
    expect(claims).toBeNull();
    expect(onDiagnostic).toHaveBeenCalledWith(expect.stringContaining("token rejected"));
  });

  it("returns null when oidc mode gets no Authorization header at all", async () => {
    const verify = vi.fn();
    const claims = await authenticateRequest(headers({}), resolveAuthMode(OIDC_ENV), {
      developmentIdentity: DEV_IDENTITY,
      verify,
    });
    expect(claims).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });
});
