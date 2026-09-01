/**
 * JIT access approve/deny.
 *
 * These used to return `{ status: "approved" }` and mutate nothing — not the
 * database (there was a `TODO(Phase 2)`), and not even the in-memory fixture.
 * The dashboard reported success and the request was still sitting in the
 * queue on the next refresh. These cover the decision actually sticking, and
 * the rule that matters for an audit trail: a request is decided once.
 *
 * Each case snapshots and restores the demo stores, so the fixture array is
 * identical at the start of every test rather than being consumed by the one
 * before it. That doubles as proof the array is registered with demo-mode —
 * without the registration these tests would interfere with each other.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter, createContext } from "../src/index.js";
import { snapshotAllDemoStores, restoreAllDemoStores } from "../src/demo-mode.js";

const claims = {
  sub: "60000000-0000-4000-8000-000000000001",
  tenant_id: "d9d9d9d9-0000-4000-8000-000000000001",
  email: "manager@acme.com",
};
const caller = () => appRouter.createCaller(createContext({ claims }));
const pending = async () => (await caller().access.pendingApprovals({ scope: null })).requests;

let snapshot: ReturnType<typeof snapshotAllDemoStores>;
beforeEach(() => {
  snapshot = snapshotAllDemoStores();
});
afterEach(() => {
  restoreAllDemoStores(snapshot);
});

describe("access decisions", () => {
  it("starts with the fixture queue non-empty (guards against vacuous cases)", async () => {
    expect((await pending()).length).toBeGreaterThan(0);
  });

  it("removes an approved request from the pending queue", async () => {
    const before = await pending();
    const id = before[0]!.id;

    const result = await caller().access.approve({ requestId: id });
    expect(result.status).toBe("approved");
    expect(result.decidedAt).toBeTruthy();

    const after = await pending();
    expect(after).toHaveLength(before.length - 1);
    expect(after.find((r) => r.id === id)).toBeUndefined();
  });

  it("removes a denied request too, and keeps the reason", async () => {
    const id = (await pending())[0]!.id;
    const result = await caller().access.deny({ requestId: id, reason: "not this quarter" });
    expect(result.status).toBe("denied");
    expect(result.message).toContain("not this quarter");
    expect((await pending()).find((r) => r.id === id)).toBeUndefined();
  });

  it("REFUSES to decide the same request twice", async () => {
    // Without this guard the audit trail would hold two contradictory
    // decisions with nothing recording which one held.
    const id = (await pending())[0]!.id;
    await caller().access.deny({ requestId: id, reason: "no" });
    await expect(caller().access.approve({ requestId: id })).rejects.toThrow(/already denied/);
  });

  it("404s on a request that does not exist", async () => {
    await expect(caller().access.approve({ requestId: "req_nope" })).rejects.toThrow(
      /No access request/,
    );
  });

  it("does not promise a credential it never issues", async () => {
    // The old message claimed "Short-lived credential issued (15-min TTL)".
    // Nothing minted one.
    const id = (await pending())[0]!.id;
    const result = await caller().access.approve({ requestId: id });
    expect(result.message).not.toMatch(/15-min TTL/);
  });

  it("drops the approvals counter on the summary panel too", async () => {
    const before = (await caller().spend.summary({ scope: null })).pendingApprovals;
    await caller().access.approve({ requestId: (await pending())[0]!.id });
    expect((await caller().spend.summary({ scope: null })).pendingApprovals).toBe(before - 1);
  });
});
