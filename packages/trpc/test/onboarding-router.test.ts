/**
 * Onboarding router tests (docs/guides/03-client-downloader.md §4).
 *
 * Covers: questionnaire retrieval, structured-answers-only scoring +
 * recommendation (A5), setup-token issuance/redemption (A4, single-use,
 * rate-limited, TTL), and the A6 auto-approve/pending_approval split.
 */

import { describe, it, expect } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import { verifyManifestIntegrity } from "@arm/client-core";
import { __test } from "../src/onboarding-router.js";

// package_assignment.tenant_id is UUID-constrained (proto, frozen) — unlike
// some other fixture routers in this codebase, a plain "tn_01"-style id
// would fail packageAssignmentSchema.parse() inside completeRedemption().
const authedClaims: ARMClaims = {
  sub: "user_01",
  tenant_id: "d9d9d9d9-1111-4111-8111-000000000001",
  email: "eng@acme.com",
};
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

const MAINTENANCE_ANSWERS = {
  location: "plant_a",
  role_cluster: "maintenance",
  weekly_tasks: ["troubleshoot_equipment", "preventive_maintenance"],
  systems: ["cmms"],
  code_plc: "no",
  work_style: "chat_first",
  platform: "macos",
};

describe("onboarding tenant middleware", () => {
  it("REJECTS unauthenticated getQuestionnaire/submitResponse/recommend/issueSetupToken", async () => {
    await expect(caller(null).onboarding.getQuestionnaire()).rejects.toThrow(/No authenticated tenant context/);
    await expect(
      caller(null).onboarding.submitResponse({ answers: {} }),
    ).rejects.toThrow(/No authenticated tenant context/);
    await expect(caller(null).onboarding.recommend({ answers: {} })).rejects.toThrow(
      /No authenticated tenant context/,
    );
    await expect(
      caller(null).onboarding.issueSetupToken({ packageVersionIds: ["x"] }),
    ).rejects.toThrow(/No authenticated tenant context/);
  });

  it("ALLOWS unauthenticated redeemSetupToken/resolveActivationCode (the token IS the credential, A4)", async () => {
    const result = await caller(null).onboarding.redeemSetupToken({ token: "not-a-real-token" });
    expect(result.status).toBe("invalid");
  });
});

describe("getQuestionnaire", () => {
  it("returns the manufacturing graph by default", async () => {
    const r = await caller(authedClaims).onboarding.getQuestionnaire();
    expect(r.questionnaire.industryProfile).toBe("manufacturing");
    expect(r.questionnaire.graph.entry).toBe("location");
    expect(r.questionnaire.status).toBe("published");
  });

  it("returns the tech graph when requested", async () => {
    const r = await caller(authedClaims).onboarding.getQuestionnaire({ industryProfile: "tech" });
    expect(r.questionnaire.industryProfile).toBe("tech");
  });
});

describe("submitResponse — structured answers only (A5)", () => {
  it("rejects a free-text-shaped answer value (an object is not string|string[]|number|boolean)", async () => {
    await expect(
      caller(authedClaims).onboarding.submitResponse({
        answers: { role_cluster: { nested: "not allowed" } as unknown as string },
      }),
    ).rejects.toThrow();
  });

  it("resolves maintenance_technician for a maintenance-heavy answer set and recommends the matching package", async () => {
    const before = __test.responseStore.length;
    const r = await caller(authedClaims).onboarding.submitResponse({ answers: MAINTENANCE_ANSWERS });
    expect(r.resolvedJobFunctionKey).toBe("maintenance_technician");
    expect(r.recommendations[0]?.slug).toBe("maintenance_technician");
    expect(r.recommendations[0]?.exactMatch).toBe(true);
    expect(__test.responseStore.length).toBe(before + 1);
    const stored = __test.responseStore.at(-1)!;
    expect(stored.answers).toEqual(MAINTENANCE_ANSWERS);
    expect(stored.resolvedJobFunctionKey).toBe("maintenance_technician");
  });

  it("records a structured unmatched marker (null job function, no free text) for none_of_these", async () => {
    const r = await caller(authedClaims).onboarding.submitResponse({
      answers: { location: "plant_a", role_cluster: "none_of_these" },
    });
    expect(r.resolvedJobFunctionKey).toBeNull();
    expect(r.recommendations).toEqual([]);
  });
});

describe("recommend — pure re-run, no storage side effect", () => {
  it("does not append to responseStore", async () => {
    const before = __test.responseStore.length;
    const r = await caller(authedClaims).onboarding.recommend({ answers: MAINTENANCE_ANSWERS });
    expect(r.recommendations[0]?.slug).toBe("maintenance_technician");
    expect(__test.responseStore.length).toBe(before);
  });
});

describe("issueSetupToken + redeemSetupToken (A4)", () => {
  const OFFICE_VERSION_ID = "40000000-0000-4000-8000-000000000004"; // office_worker_general — approval_required: false
  const QUALITY_VERSION_ID = "40000000-0000-4000-8000-000000000001"; // quality_engineer — approval_required: true

  it("issues a JWT-shaped token + 6-char activation code with a 15-minute TTL", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    expect(issued.token.split(".")).toHaveLength(3); // header.payload.signature
    expect(issued.activationCode).toMatch(/^[A-Z0-9]{6}$/);
    const ttlMs = new Date(issued.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("redeems a fresh token: auto-approves when approval_required=false (A6) and the manifest verifies client-side", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    const redeemed = await caller(null).onboarding.redeemSetupToken({ token: issued.token, clientVersion: "1.0.0" });

    expect(redeemed.status).toBe("ok");
    expect(redeemed.pending_approval).toBe(false);
    expect(redeemed.manifest?.package.role_key).toBe("office_worker_general");
    expect(redeemed.manifest?.version.manifest_version).toBe(2);
    // The manifest this router mints must verify with the SAME client-core
    // function the real client uses — this is the whole point of computing
    // manifest_sha256 fresh (module doc header).
    expect(verifyManifestIntegrity(redeemed.manifest!.version)).toBe(true);

    const assignment = __test.assignmentStore.find((a) => a.package_version_id === redeemed.manifest!.version.id);
    expect(assignment?.status).toBe("approved");
  });

  it("resolves the version's real @arm/artifactory components (not the empty [] this router shipped with pre-integration)", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [QUALITY_VERSION_ID],
    });
    const redeemed = await caller(null).onboarding.redeemSetupToken({ token: issued.token });

    const components = redeemed.manifest!.components as Array<{
      component: { slug: string; id: string };
      version: { component_id: string; version: string; manifest_sha256: string };
    }>;
    expect(components.length).toBeGreaterThan(0);
    expect(components.map((c) => c.component.slug)).toContain("jira");
    for (const { component, version } of components) {
      expect(version.component_id).toBe(component.id);
      expect(version.manifest_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    // The manifest hash covers the real components array — verifies with
    // the same canonicalizer the client re-checks against.
    expect(verifyManifestIntegrity(redeemed.manifest!.version)).toBe(true);
  });

  it("redeems a fresh token: routes to pending_approval when approval_required=true (A6)", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [QUALITY_VERSION_ID],
    });
    const redeemed = await caller(null).onboarding.redeemSetupToken({ token: issued.token });

    expect(redeemed.status).toBe("ok");
    expect(redeemed.pending_approval).toBe(true);
    const assignment = __test.assignmentStore.find((a) => a.package_version_id === redeemed.manifest!.version.id);
    expect(assignment?.status).toBe("requested");
  });

  it("a second redemption of the same token returns already_used (single-use)", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    const first = await caller(null).onboarding.redeemSetupToken({ token: issued.token });
    expect(first.status).toBe("ok");
    const second = await caller(null).onboarding.redeemSetupToken({ token: issued.token });
    expect(second.status).toBe("already_used");
    expect(second.message).toMatch(/already used/);
  });

  it("an expired token returns expired", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    // Force expiry directly on the store (avoids a real 15-minute sleep).
    const jti = issued.token.split(".")[1] ? JSON.parse(Buffer.from(issued.token.split(".")[1]!, "base64url").toString("utf8")).jti as string : "";
    const stored = __test.setupTokenStore.get(jti)!;
    stored.expiresAt = Date.now() - 1;

    const redeemed = await caller(null).onboarding.redeemSetupToken({ token: issued.token });
    expect(redeemed.status).toBe("expired");
  });

  it("resolveActivationCode redeems via the 6-char code through the same single-use path", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    const redeemed = await caller(null).onboarding.resolveActivationCode({ code: issued.activationCode });
    expect(redeemed.status).toBe("ok");
    expect(redeemed.manifest?.package.role_key).toBe("office_worker_general");

    // Same underlying token — redeeming again via the raw JWT now says already_used.
    const second = await caller(null).onboarding.redeemSetupToken({ token: issued.token });
    expect(second.status).toBe("already_used");
  });

  it("resolveActivationCode is case-insensitive", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    const redeemed = await caller(null).onboarding.resolveActivationCode({
      code: issued.activationCode.toLowerCase(),
    });
    expect(redeemed.status).toBe("ok");
  });

  it("an unknown activation code returns invalid", async () => {
    const redeemed = await caller(null).onboarding.resolveActivationCode({ code: "ZZZZZZ" });
    expect(redeemed.status).toBe("invalid");
  });

  it("the setup token never carries a credential/secret/free-text field (contract test, guide 00 §5.2)", async () => {
    const issued = await caller(authedClaims).onboarding.issueSetupToken({
      packageVersionIds: [OFFICE_VERSION_ID],
    });
    const payload = JSON.parse(Buffer.from(issued.token.split(".")[1]!, "base64url").toString("utf8"));
    const forbidden = /secret|token|password|key|answer|text/i;
    for (const field of Object.keys(payload)) {
      expect(field).not.toMatch(forbidden);
    }
  });

  it("rate-limits repeated redemption attempts with malformed tokens", async () => {
    let lastMessage = "";
    for (let i = 0; i < 15; i++) {
      const r = await caller(null).onboarding.redeemSetupToken({ token: `garbage-${i}` });
      lastMessage = r.message;
    }
    expect(lastMessage).toMatch(/too many attempts/);
  });
});
