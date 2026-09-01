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
  it("REFUSES rather than returning an empty result and a fabricated audit id", async () => {
    // This test used to assert `result.auditId).toContain("audit_db")` — an id
    // for an audit record that was never written. A fabricated audit id is
    // worse than none: it survives into logs and incident reviews as evidence
    // of something that did not happen.
    await expect(
      proxyDBQuery({
        agentId: "agt_01",
        tenantId: "tn_01",
        dbType: "postgres",
        database: "analytics",
        query: "SELECT 1",
        classificationClearance: "internal",
      }),
    ).rejects.toThrow(/not configured/i);
  });
});

describe("SharePoint connector — mint+sync hybrid", () => {
  const spReq = {
    agentId: "agt_01",
    tenantId: "tn_01",
    siteUrl: "https://acme.sharepoint.com/sites/eng",
    scopes: ["sites.read", "files.read"] as ("sites.read" | "files.read")[],
    classificationClearance: "internal" as const,
  };

  it("exchanges client credentials for a real Graph token", async () => {
    // It used to return `EwC_MOCK_...` unconditionally, and this test asserted
    // the mock prefix.
    const token = await mintSharePointToken(
      spReq,
      { tenantId: "t", clientId: "c", clientSecret: "s" },
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "real.graph.token", expires_in: 3600 }),
        text: async () => "",
      }),
    );
    expect(token.simulated).toBe(false);
    expect(token.accessToken).toBe("real.graph.token");
  });

  it("never hands on a lifetime longer than Graph granted", async () => {
    const token = await mintSharePointToken(
      { ...spReq, ttlMinutes: 60 },
      { tenantId: "t", clientId: "c", clientSecret: "s" },
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "t", expires_in: 300 }),
        text: async () => "",
      }),
    );
    expect(new Date(token.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 300_000 + 2000);
  });

  it("marks an unconfigured token as simulated and never claims otherwise", async () => {
    const token = await mintSharePointToken(spReq, {});
    expect(token.simulated).toBe(true);
    expect(token.accessToken).toBe("SIMULATED_NOT_A_TOKEN");
  });
  it("REFUSES to report no-drift without contacting Graph", async () => {
    // The old behaviour, which this test used to assert: `syncedGrants: 12,
    // driftDetected: false` from a function that made no network call. A
    // drift detector reporting "clean" without looking is a false negative on
    // a security control.
    const result = await syncSharePointPermissions("https://acme.sharepoint.com/sites/eng");
    expect(result.status).toBe("not_checked");
    expect(result.statusDetail).toContain("NOT evaluated");
    expect(result.syncedGrants).toBe(0);
  });

  it("reports not_checked when a simulated token is passed", async () => {
    const token = await mintSharePointToken(spReq, {});
    const result = await syncSharePointPermissions(spReq.siteUrl, token);
    expect(result.status).toBe("not_checked");
  });

  it("counts the permissions Graph actually returned", async () => {
    const result = await syncSharePointPermissions(
      spReq.siteUrl,
      { accessToken: "real", expiresAt: "", siteUrl: spReq.siteUrl, scopes: [], simulated: false },
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            { id: "p1", grantedToV2: { user: { displayName: "Ada" } } },
            { id: "p2", grantedToV2: { user: { displayName: "Grace" } } },
          ],
        }),
        text: async () => "",
      }),
    );
    expect(result.status).toBe("checked");
    expect(result.syncedGrants).toBe(2);
    expect(result.driftDetails).toEqual(["Ada", "Grace"]);
  });

  it("reports not_checked when Graph errors, rather than clean", async () => {
    const result = await syncSharePointPermissions(
      spReq.siteUrl,
      { accessToken: "real", expiresAt: "", siteUrl: spReq.siteUrl, scopes: [], simulated: false },
      async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => "denied" }),
    );
    expect(result.status).toBe("not_checked");
    expect(result.statusDetail).toContain("403");
  });
});

describe("S3 credential minting — real STS exchange", () => {
  // It used to return `MOCK_SECRET_${Math.random()...}` unconditionally: a
  // credential-shaped value that cannot work, discovered only at the point of
  // use as an opaque AWS error.
  const req = {
    agentId: "agt_1",
    tenantId: "tn_1",
    bucket: "acme-cad",
    actions: ["s3:GetObject", "s3:ListBucket"],
    classificationClearance: "internal" as const,
  };

  const STS_XML = `<AssumeRoleWithWebIdentityResponse><AssumeRoleWithWebIdentityResult><Credentials>
    <AccessKeyId>ASIAREAL</AccessKeyId>
    <SecretAccessKey>realsecret</SecretAccessKey>
    <SessionToken>realsession</SessionToken>
    <Expiration>2026-07-01T12:00:00Z</Expiration>
  </Credentials></AssumeRoleWithWebIdentityResult></AssumeRoleWithWebIdentityResponse>`;

  it("exchanges the OIDC token for real STS credentials", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    let sentBody = "";
    const cred = await mintS3Credential(
      req,
      { roleArn: "arn:aws:iam::1:role/arm", region: "eu-west-1", webIdentityToken: "tok" },
      async (_url, body) => {
        sentBody = body;
        return { ok: true, status: 200, text: async () => STS_XML };
      },
    );
    expect(cred.simulated).toBe(false);
    expect(cred.accessKeyId).toBe("ASIAREAL");
    expect(sentBody).toContain("Action=AssumeRoleWithWebIdentity");
    // Session name lands in CloudTrail — the agent must be attributable.
    expect(decodeURIComponent(sentBody)).toContain("arm-agt_1");
  });

  it("scopes the inline policy to exactly the requested bucket and prefix", async () => {
    const { buildInlinePolicy } = await import("../src/s3.js");
    const policy = JSON.parse(buildInlinePolicy(req, "tn_1/agt_1/"));
    expect(policy.Statement[0].Resource).toContain("arn:aws:s3:::acme-cad/tn_1/agt_1/*");
    // Non-s3 verbs must never reach an S3 policy document.
    expect(policy.Statement[0].Action).toEqual(["s3:GetObject", "s3:ListBucket"]);
  });

  it("caps the TTL at one hour (Invariant 11.4)", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    let body = "";
    await mintS3Credential(
      { ...req, ttlMinutes: 600 },
      { roleArn: "arn:aws:iam::1:role/arm", webIdentityToken: "tok" },
      async (_u, b) => {
        body = b;
        return { ok: true, status: 200, text: async () => STS_XML };
      },
    );
    expect(body).toContain("DurationSeconds=3600");
  });

  it("THROWS rather than returning a partial credential on an unreadable response", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    await expect(
      mintS3Credential(req, { roleArn: "arn:x", webIdentityToken: "tok" }, async () => ({
        ok: true,
        status: 200,
        text: async () => "<AssumeRoleWithWebIdentityResponse/>",
      })),
    ).rejects.toThrow(/could not read/);
  });

  it("THROWS on an STS error rather than falling back to something unusable", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    await expect(
      mintS3Credential(req, { roleArn: "arn:x", webIdentityToken: "tok" }, async () => ({
        ok: false,
        status: 403,
        text: async () => "AccessDenied",
      })),
    ).rejects.toThrow(/403/);
  });

  it("marks an unconfigured dev credential as simulated, and never claims otherwise", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    const cred = await mintS3Credential(req, {});
    expect(cred.simulated).toBe(true);
    expect(cred.secretAccessKey).toBe("SIMULATED_NOT_A_CREDENTIAL");
  });

  it("REFUSES to simulate under NODE_ENV=production", async () => {
    const { mintS3Credential } = await import("../src/s3.js");
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(mintS3Credential(req, {})).rejects.toThrow(/Refusing to return a simulated/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
