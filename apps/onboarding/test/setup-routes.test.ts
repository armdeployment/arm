/**
 * REST wrapper tests for apps/onboarding's setup-token redemption routes
 * (docs/guides/03-client-downloader.md §3/§5) — the wire contract
 * `@arm/client-core`'s `resolveFromSetupToken` (the A4 CLI path) speaks.
 * Exercises the route handlers directly (no HTTP server needed — Next.js
 * route handlers are plain functions of Request -> Response).
 */

import { describe, it, expect } from "vitest";
import { appRouter, createContext } from "@arm/trpc";
import { verifyManifestIntegrity } from "@arm/client-core";
import { POST as redeemPost } from "../src/app/api/setup/redeem/route.js";
import { POST as resolveCodePost } from "../src/app/api/setup/resolve-code/route.js";

const OFFICE_VERSION_ID = "40000000-0000-4000-8000-000000000004"; // approval_required: false

async function issueToken() {
  const caller = appRouter.createCaller(
    createContext({ claims: { sub: "u1", tenant_id: "d9d9d9d9-0000-4000-8000-000000000001", email: "e@acme.com" } }),
  );
  return caller.onboarding.issueSetupToken({ packageVersionIds: [OFFICE_VERSION_ID] });
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/setup/redeem", () => {
  it("redeems a fresh token and returns a manifest that verifies client-side", async () => {
    const issued = await issueToken();
    const res = await redeemPost(jsonRequest("http://localhost/api/setup/redeem", { token: issued.token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.manifest.package.role_key).toBe("office_worker_general");
    expect(verifyManifestIntegrity(body.manifest.version)).toBe(true);
    expect(body.pending_approval).toBe(false);
  });

  it("responds 200 with status:invalid for a missing token (never a 4xx/5xx — REST facade contract)", async () => {
    const res = await redeemPost(jsonRequest("http://localhost/api/setup/redeem", {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("invalid");
  });

  it("responds status:invalid for a malformed body", async () => {
    const res = await redeemPost(
      new Request("http://localhost/api/setup/redeem", { method: "POST", body: "not json" }),
    );
    const body = await res.json();
    expect(body.status).toBe("invalid");
  });

  it("a second redemption of the same token returns already_used", async () => {
    const issued = await issueToken();
    await redeemPost(jsonRequest("http://localhost/api/setup/redeem", { token: issued.token }));
    const second = await redeemPost(jsonRequest("http://localhost/api/setup/redeem", { token: issued.token }));
    const body = await second.json();
    expect(body.status).toBe("already_used");
  });
});

describe("POST /api/setup/resolve-code", () => {
  it("redeems via the 6-char activation code", async () => {
    const issued = await issueToken();
    const res = await resolveCodePost(
      jsonRequest("http://localhost/api/setup/resolve-code", { code: issued.activationCode }),
    );
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.manifest.package.role_key).toBe("office_worker_general");
  });

  it("responds status:invalid for a code that isn't 6 characters", async () => {
    const res = await resolveCodePost(jsonRequest("http://localhost/api/setup/resolve-code", { code: "ABC" }));
    const body = await res.json();
    expect(body.status).toBe("invalid");
  });

  it("responds status:invalid for an unknown code", async () => {
    const res = await resolveCodePost(jsonRequest("http://localhost/api/setup/resolve-code", { code: "ZZZZZZ" }));
    const body = await res.json();
    expect(body.status).toBe("invalid");
  });
});
