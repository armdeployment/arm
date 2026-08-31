import { describe, it, expect } from "vitest";
import { mintS3Credential, validateS3Access } from "../src/s3.js";
import { mintGCSCredential } from "../src/gcs.js";
import { proxyDBQuery } from "../src/db.js";
import { mintSharePointToken, syncSharePointPermissions } from "../src/sharepoint.js";

describe("S3 connector — mint strategy", () => {
  const req = {
    agentId: "agt_01",
    tenantId: "tn_01",
    bucket: "my-data",
    actions: ["s3:GetObject"],
    classificationClearance: "internal" as const,
  };
  it("mints a short-lived credential (≤60 min)", async () => {
    const cred = await mintS3Credential(req);
    expect(cred.accessKeyId).toContain("ASIA");
    const exp = new Date(cred.expiration).getTime() - Date.now();
    expect(exp).toBeGreaterThan(0);
    expect(exp).toBeLessThan(60 * 60_000 + 1000); // ≤60min + 1s tolerance
  });
  it("validates S3 access", () => {
    expect(validateS3Access(req).allowed).toBe(true);
  });
});

describe("GCS connector — mint strategy", () => {
  const req = {
    agentId: "agt_01",
    tenantId: "tn_01",
    bucket: "data-bucket",
    actions: ["read"] as "read"[],
    classificationClearance: "internal" as const,
  };
  it("mints a credential with signed URL", async () => {
    const cred = await mintGCSCredential(req);
    expect(cred.accessToken).toContain("ya29");
    expect(cred.signedUrl).toContain("storage.googleapis.com");
  });
});

describe("DB connector — proxy strategy", () => {
  it("proxies a query and returns audit result", async () => {
    const result = await proxyDBQuery({
      agentId: "agt_01",
      tenantId: "tn_01",
      dbType: "postgres",
      database: "analytics",
      query: "SELECT 1",
      classificationClearance: "internal",
    });
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.auditId).toContain("audit_db");
  });
});

describe("SharePoint connector — mint+sync hybrid", () => {
  it("mints a scoped Graph API token", async () => {
    const token = await mintSharePointToken({
      agentId: "agt_01",
      tenantId: "tn_01",
      siteUrl: "https://acme.sharepoint.com/sites/eng",
      scopes: ["sites.read", "files.read"],
      classificationClearance: "internal",
    });
    expect(token.accessToken).toContain("EwC");
    expect(new Date(token.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
  it("syncs permissions with drift detection", async () => {
    const result = await syncSharePointPermissions("https://acme.sharepoint.com/sites/eng");
    expect(result.syncedGrants).toBe(12);
    expect(result.driftDetected).toBe(false);
  });
});
