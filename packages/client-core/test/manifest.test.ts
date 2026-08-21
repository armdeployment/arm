import { describe, it, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import {
  fetchManifest,
  verifyManifestIntegrity,
  clientPackageManifestSchema,
} from "../src/manifest.js";
import { makeManifest, makeVersion, tamperHash } from "./helpers.js";

describe("verifyManifestIntegrity", () => {
  it("accepts a manifest hashed via manifestSha256", () => {
    const version = makeVersion();
    expect(verifyManifestIntegrity(version)).toBe(true);
  });

  it("rejects a tampered field", () => {
    const version = makeVersion({ skills: ["tampered-skill"] });
    // makeVersion hashes whatever it built, so this passes by construction;
    // tamper after hashing to simulate a real attack.
    const honest = makeVersion();
    const tampered = { ...honest, skills: ["tampered-skill"] };
    expect(verifyManifestIntegrity(tampered)).toBe(false);
    expect(verifyManifestIntegrity(honest)).toBe(true);
    void version;
  });

  it("rejects a tampered hash", () => {
    expect(verifyManifestIntegrity(tamperHash(makeVersion()))).toBe(false);
  });

  it("rejects a tampered tool ref", () => {
    const honest = makeVersion();
    const tampered = {
      ...honest,
      tools: [
        {
          tool_id: honest.tools[0]!.tool_id,
          tool_version: "9.9.9",
          scopes: honest.tools[0]!.scopes,
        },
      ],
    };
    expect(verifyManifestIntegrity(tampered)).toBe(false);
  });
});

describe("fetchManifest", () => {
  let server: Server;
  let baseUrl: string;
  const manifest = makeManifest();

  async function startServer(handler: (path: string) => { status: number; body: unknown }) {
    server = createServer((req, res) => {
      const { status, body } = handler(req.url ?? "/");
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function stopServer() {
    if (!server) return;
    server.close();
    await once(server, "close");
  }

  it("fetches and validates a manifest over HTTP", async () => {
    await startServer((path) =>
      path === "/api/catalog/packages/quality_engineer/manifest"
        ? { status: 200, body: manifest }
        : { status: 404, body: { error: "not found" } },
    );
    try {
      const result = await fetchManifest(baseUrl, "token", "quality_engineer");
      expect(result.package.role_key).toBe("quality_engineer");
      expect(result.version.version).toBe("1.0.0");
      expect(result.tools.map((t) => t.name)).toContain("jira");
      expect(verifyManifestIntegrity(result.version)).toBe(true);
    } finally {
      await stopServer();
    }
  });

  it("throws on non-200", async () => {
    await startServer(() => ({ status: 403, body: { error: "denied" } }));
    try {
      await expect(fetchManifest(baseUrl, "token", "quality_engineer")).rejects.toThrow(/HTTP 403/);
    } finally {
      await stopServer();
    }
  });

  it("throws on schema-invalid payloads", async () => {
    await startServer(() => ({ status: 200, body: { package: { nope: true } } }));
    try {
      await expect(fetchManifest(baseUrl, "token", "quality_engineer")).rejects.toThrow(
        /invalid payload/,
      );
    } finally {
      await stopServer();
    }
  });

  it("schema rejects a manifest with a bad integrity hash", () => {
    const parsed = clientPackageManifestSchema.safeParse({
      ...manifest,
      version: { ...manifest.version, manifest_sha256: "not-hex" },
    });
    expect(parsed.success).toBe(false);
  });
});
