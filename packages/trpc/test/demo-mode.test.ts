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
import {
  isDemoMode,
  registerDemoArray,
  snapshotAllDemoStores,
  restoreAllDemoStores,
  demoStoreCount,
} from "../src/demo-mode.js";

const fixtureTenantClaims: ARMClaims = {
  sub: "user_01",
  tenant_id: FIXTURE_TENANT_ID,
  email: "eng@acme.com",
};
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

describe("snapshots are DEEP — the rollback covers in-place mutation", () => {
  // The bug this pins: `registerDemoArray` snapshotted with `[...store]`,
  // which copies the array and shares every element. That was invisible while
  // routers only pushed and spliced, and wrong the moment one mutated a field
  // on an existing object — `request.status = "approved"` also mutated the
  // object inside the snapshot, so restore put the mutated object back.
  //
  // ARM_DEMO promises every mutation is rolled back. Shallow copying quietly
  // narrowed that to "every mutation that replaces an element", which is not a
  // distinction anyone writing a resolver would think to make.
  it("rolls back a FIELD mutation on an existing element", async () => {
    const { registerDemoArray, snapshotAllDemoStores, restoreAllDemoStores } =
      await import("../src/demo-mode.js");
    const store = [{ id: "a", status: "pending" as string }];
    registerDemoArray(store);

    const snap = snapshotAllDemoStores();
    store[0]!.status = "approved";
    restoreAllDemoStores(snap);

    expect(store[0]!.status).toBe("pending");
  });

  it("rolls back a nested mutation", async () => {
    const { registerDemoArray, snapshotAllDemoStores, restoreAllDemoStores } =
      await import("../src/demo-mode.js");
    const store = [{ id: "a", meta: { tags: ["one"] } }];
    registerDemoArray(store);

    const snap = snapshotAllDemoStores();
    store[0]!.meta.tags.push("two");
    restoreAllDemoStores(snap);

    expect(store[0]!.meta.tags).toEqual(["one"]);
  });

  it("survives restoring from the same snapshot twice", async () => {
    // Restore also clones. Without that, the first restore would hand the
    // store the snapshot's own objects, and the next mutation would corrupt
    // the snapshot it is supposed to be able to restore from again.
    const { registerDemoArray, snapshotAllDemoStores, restoreAllDemoStores } =
      await import("../src/demo-mode.js");
    const store = [{ id: "a", status: "pending" as string }];
    registerDemoArray(store);
    const snap = snapshotAllDemoStores();

    store[0]!.status = "approved";
    restoreAllDemoStores(snap);
    store[0]!.status = "denied";
    restoreAllDemoStores(snap);

    expect(store[0]!.status).toBe("pending");
  });

  it("rolls back a field mutation inside a Map value too", async () => {
    const { registerDemoMap, snapshotAllDemoStores, restoreAllDemoStores } =
      await import("../src/demo-mode.js");
    const store = new Map<string, { hits: number }>([["k", { hits: 0 }]]);
    registerDemoMap(store);

    const snap = snapshotAllDemoStores();
    store.get("k")!.hits = 99;
    restoreAllDemoStores(snap);

    expect(store.get("k")!.hits).toBe(0);
  });
});
