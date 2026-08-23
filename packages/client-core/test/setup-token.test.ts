/**
 * The A4 token path (guide 03 §1/§5): resolveFromSetupToken redeems a raw
 * JWT or a 6-char activation code against a mock control plane implementing
 * the REST contract documented in src/setup-token.ts, and returns a
 * SetupArgs runSetup can consume unchanged.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { resolveFromSetupToken } from "../src/setup-token.js";
import { ArmClientError } from "../src/errors.js";
import { makeManifest, TENANT_ID } from "./helpers.js";

describe("resolveFromSetupToken", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
  });

  async function startMockControlPlane(
    handlers: Partial<{
      redeem: (body: unknown) => { status: number; body: unknown };
      resolveCode: (body: unknown) => { status: number; body: unknown };
    }>,
  ) {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
        let result: { status: number; body: unknown } | undefined;
        if (req.url === "/api/setup/redeem" && handlers.redeem) {
          result = handlers.redeem(body);
        } else if (req.url === "/api/setup/resolve-code" && handlers.resolveCode) {
          result = handlers.resolveCode(body);
        }
        if (!result) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.statusCode = result.status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function okResponse(overrides: Record<string, unknown> = {}) {
    const manifest = makeManifest();
    return {
      status: "ok" as const,
      message: "",
      manifest,
      connections: [],
      sub_account_id: "sa_123",
      tenant_id: TENANT_ID,
      proxy_url: "https://data.arm.acme.com",
      data_plane_url: "https://artifacts.arm.acme.com",
      catalog_token: "catalog-token-from-redemption",
      agent_token: "arm_mtr_from_redemption",
      pending_approval: false,
      ...overrides,
    };
  }

  it("redeems a raw JWT-shaped token via /api/setup/redeem", async () => {
    const baseUrl = await startMockControlPlane({
      redeem: (body) => {
        expect((body as { token: string }).token).toBe("header.payload.signature");
        return { status: 200, body: okResponse() };
      },
    });

    const args = await resolveFromSetupToken({
      token: "header.payload.signature",
      controlPlaneUrl: baseUrl,
    });

    expect(args.roleKey).toBe("quality_engineer");
    expect(args.subAccountId).toBe("sa_123");
    expect(args.tenantId).toBe(TENANT_ID);
    expect(args.armProxyUrl).toBe("https://data.arm.acme.com");
    expect(args.dataPlaneUrl).toBe("https://artifacts.arm.acme.com");
    expect(args.token).toBe("catalog-token-from-redemption");
    expect(args.agentToken).toBe("arm_mtr_from_redemption");
    expect(args.pendingApproval).toBe(false);
    expect(args.manifest).toBeDefined();
    expect(args.controlPlaneUrl).toBe(baseUrl);
  });

  it("routes a 6-char code to /api/setup/resolve-code, uppercased", async () => {
    const baseUrl = await startMockControlPlane({
      resolveCode: (body) => {
        expect((body as { code: string }).code).toBe("AB12CD");
        return { status: 200, body: okResponse() };
      },
    });

    const args = await resolveFromSetupToken({ token: "ab12cd", controlPlaneUrl: baseUrl });
    expect(args.roleKey).toBe("quality_engineer");
  });

  it("surfaces pending_approval through SetupArgs (A6)", async () => {
    const baseUrl = await startMockControlPlane({
      redeem: () => ({ status: 200, body: okResponse({ pending_approval: true }) }),
    });
    const args = await resolveFromSetupToken({ token: "a.b.c", controlPlaneUrl: baseUrl });
    expect(args.pendingApproval).toBe(true);
  });

  it("throws TOKEN_ALREADY_USED on a second redemption", async () => {
    const baseUrl = await startMockControlPlane({
      redeem: () => ({
        status: 200,
        body: {
          status: "already_used",
          message: "this setup link was already used — ask IT for a new one",
        },
      }),
    });
    const err = await resolveFromSetupToken({ token: "a.b.c", controlPlaneUrl: baseUrl }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("TOKEN_ALREADY_USED");
  });

  it("throws TOKEN_EXPIRED for an expired token", async () => {
    const baseUrl = await startMockControlPlane({
      redeem: () => ({ status: 200, body: { status: "expired", message: "link expired" } }),
    });
    const err = await resolveFromSetupToken({ token: "a.b.c", controlPlaneUrl: baseUrl }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("TOKEN_EXPIRED");
  });

  it("throws MANIFEST_TAMPERED when the redeemed manifest fails integrity verification", async () => {
    const baseUrl = await startMockControlPlane({
      redeem: () => {
        const manifest = makeManifest();
        return {
          status: 200,
          body: okResponse({
            manifest: { ...manifest, version: { ...manifest.version, manifest_sha256: "0".repeat(64) } },
          }),
        };
      },
    });
    const err = await resolveFromSetupToken({ token: "a.b.c", controlPlaneUrl: baseUrl }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("MANIFEST_TAMPERED");
  });

  it("throws PROXY_UNREACHABLE when the control plane cannot be reached", async () => {
    const err = await resolveFromSetupToken({
      token: "a.b.c",
      controlPlaneUrl: "http://127.0.0.1:1",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("PROXY_UNREACHABLE");
  });
});
