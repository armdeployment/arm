import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { pullComponentBlob, installComponent, installDirFor } from "../src/components.js";
import { ArmClientError } from "../src/errors.js";
import { makeComponent, makeComponentVersion, SKILL_BLOB_DIGEST, SKILL_BLOB_TEXT } from "./helpers.js";

describe("installDirFor", () => {
  it("maps installable kinds to their agent-home subdirectory", () => {
    expect(installDirFor("skill")).toBe("skills");
    expect(installDirFor("subagent")).toBe("subagents");
    expect(installDirFor("template")).toBe("templates");
    expect(installDirFor("prompt_pack")).toBe("prompt_packs");
    expect(installDirFor("plugin")).toBe("plugins");
  });

  it("returns null for callable kinds — those become MCP entries, not files", () => {
    expect(installDirFor("mcp")).toBeNull();
    expect(installDirFor("http_api")).toBeNull();
    expect(installDirFor("cli")).toBeNull();
    expect(installDirFor("connector")).toBeNull();
  });
});

describe("pullComponentBlob", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
  });

  async function startServer(body: string | null, status = 200) {
    const server = createServer((req, res) => {
      if (body === null) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.statusCode = status;
      res.end(body);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("fetches and verifies a matching digest", async () => {
    const baseUrl = await startServer(SKILL_BLOB_TEXT);
    const bytes = await pullComponentBlob(baseUrl, SKILL_BLOB_DIGEST);
    expect(bytes.toString("utf8")).toBe(SKILL_BLOB_TEXT);
  });

  it("hard-fails DIGEST_MISMATCH when the served bytes don't match the digest", async () => {
    const baseUrl = await startServer("tampered content, not the real blob");
    const err = await pullComponentBlob(baseUrl, SKILL_BLOB_DIGEST).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("DIGEST_MISMATCH");
  });

  it("hard-fails DIGEST_MISMATCH on a malformed digest string", async () => {
    const baseUrl = await startServer(SKILL_BLOB_TEXT);
    const err = await pullComponentBlob(baseUrl, "not-a-digest").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("DIGEST_MISMATCH");
  });

  it("hard-fails DIGEST_MISMATCH on a 404", async () => {
    const baseUrl = await startServer(null);
    const err = await pullComponentBlob(baseUrl, SKILL_BLOB_DIGEST).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("DIGEST_MISMATCH");
  });
});

describe("installComponent", () => {
  const servers: Server[] = [];
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is a no-op for callable components (no blob install — MCP entry instead)", async () => {
    const agentHome = await mkdtemp(join(tmpdir(), "arm-cc-"));
    tempDirs.push(agentHome);
    const resolved = {
      component: makeComponent({ kind: "mcp" }),
      version: makeComponentVersion(),
    };
    const result = await installComponent(resolved, { dataPlaneUrl: "http://unused", agentHome });
    expect(result.installedPath).toBeNull();
  });

  it("installs a skill component's blob into <agentHome>/skills/<slug>", async () => {
    const server = createServer((req, res) => {
      res.statusCode = 200;
      res.end(SKILL_BLOB_TEXT);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    const dataPlaneUrl = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;

    const agentHome = await mkdtemp(join(tmpdir(), "arm-cc-"));
    tempDirs.push(agentHome);

    const resolved = {
      component: makeComponent({ kind: "skill", slug: "8d-generator", endpoint: null, auth_strategy: null }),
      version: makeComponentVersion({ blob_digest: SKILL_BLOB_DIGEST }),
    };
    const result = await installComponent(resolved, { dataPlaneUrl, agentHome });
    expect(result.installedPath).toBe(join(agentHome, "skills", "8d-generator"));
    expect(await readFile(result.installedPath!, "utf8")).toBe(SKILL_BLOB_TEXT);
  });

  it("is a no-op for installable components with no blob_digest", async () => {
    const agentHome = await mkdtemp(join(tmpdir(), "arm-cc-"));
    tempDirs.push(agentHome);
    const resolved = {
      component: makeComponent({ kind: "template", slug: "8d-template" }),
      version: makeComponentVersion({ blob_digest: null }),
    };
    const result = await installComponent(resolved, { dataPlaneUrl: "http://unused", agentHome });
    expect(result.installedPath).toBeNull();
  });
});
