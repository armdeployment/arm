/**
 * ARM_DEMO guaranteed-read-only mode (src/demo-mode.ts). Proves the
 * structural guarantee end to end through the real appRouter: a mutation
 * still runs and returns its normal computed response, but the underlying
 * store is unchanged on the next call once ARM_DEMO=1.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import { FIXTURE_TENANT_ID } from "@arm/artifactory";
import { isDemoMode, registerDemoArray, snapshotAllDemoStores, restoreAllDemoStores, demoStoreCount } from "../src/demo-mode.js";

const fixtureTenantClaims: ARMClaims = { sub: "user_01", tenant_id: FIXTURE_TENANT_ID, email: "eng@acme.com" };
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

afterEach(() => {
  delete process.env["ARM_DEMO"];
});

describe("isDemoMode", () => {
  it("is false by default", () => {
    expect(isDemoMode()).toBe(false);
  });

  it("is true only when ARM_DEMO=1", () => {
    process.env["ARM_DEMO"] = "1";
    expect(isDemoMode()).toBe(true);
    process.env["ARM_DEMO"] = "true";
    expect(isDemoMode()).toBe(false); // exact match on "1", not truthy-string
  });
});

describe("registerDemoArray / snapshot / restore", () => {
  it("restores a mutated array to its snapshot", () => {
    const before = demoStoreCount();
    const arr = [1, 2, 3];
    registerDemoArray(arr);
    expect(demoStoreCount()).toBe(before + 1);

    const snap = snapshotAllDemoStores();
    arr.push(4);
    arr.shift();
    expect(arr).toEqual([2, 3, 4]);

    restoreAllDemoStores(snap);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe("ARM_DEMO end to end (library.rejectCandidate)", () => {
  // Runs LAST (alphabetically-independent describe order, but this is the
  // only test in the file that touches the real shared discoveryCandidateStore
  // — every other case here uses a locally-registered array) and always
  // reverts via ARM_DEMO itself, so it leaves no cross-test/cross-file
  // pollution regardless of run order.
  it("mutation returns a real response but leaves the store unchanged", async () => {
    process.env["ARM_DEMO"] = "1";

    const before = await caller(fixtureTenantClaims).library.listCandidates({});
    const target = before.candidates.find((c) => c.status === "new");
    expect(target).toBeDefined();

    const result = await caller(fixtureTenantClaims).library.rejectCandidate({
      candidateId: target!.id,
      reason: "demo click",
    });
    // The resolver ran for real — response reflects the rejection.
    expect(result.candidate.status).toBe("rejected");

    // But nothing persisted: the next call sees the original state.
    const after = await caller(fixtureTenantClaims).library.listCandidates({});
    const same = after.candidates.find((c) => c.id === target!.id);
    expect(same!.status).toBe("new");
  });
});
