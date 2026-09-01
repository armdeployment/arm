/**
 * requirePermission — the gate that used to always open.
 *
 * `requireToolPublish()` in library-router.ts was literally
 * `// dev mode: always authorized`, with a TODO waiting for "once ARMContext
 * carries resolved roles". It carries them now, so these cover the two
 * decisions that matter: an unauthorized caller is refused, and a deployment
 * that never wired role resolution fails closed in production rather than
 * authorizing everyone.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createContext, requirePermission } from "../src/index.js";
import type { ScopedRole } from "@arm/auth";

const claims = { sub: "u1", tenant_id: "tn_1" };
const publisher: ScopedRole = {
  name: "tool_publisher",
  permissions: ["tool:publish"],
  scopeType: "org",
  scopeId: "org",
};
const reader: ScopedRole = {
  name: "reader",
  permissions: ["catalog:read"],
  scopeType: "org",
  scopeId: "org",
};

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.ARM_FIXTURE_MODE;
});

describe("requirePermission", () => {
  it("allows a caller whose role carries the permission", () => {
    const ctx = createContext({ claims, roles: [publisher] });
    expect(() => requirePermission(ctx, "tool:publish")).not.toThrow();
  });

  it("REFUSES a caller whose roles do not carry it", () => {
    const ctx = createContext({ claims, roles: [reader] });
    expect(() => requirePermission(ctx, "tool:publish")).toThrow(/does not carry/);
  });

  it("honours a wildcard role", () => {
    const admin: ScopedRole = { ...publisher, name: "org_admin", permissions: ["*"] };
    expect(() =>
      requirePermission(createContext({ claims, roles: [admin] }), "tool:publish"),
    ).not.toThrow();
  });

  it("allows with NO roles resolved in development — a fresh clone still works", () => {
    const ctx = createContext({ claims });
    expect(ctx.roles).toEqual([]);
    expect(() => requirePermission(ctx, "tool:publish")).not.toThrow();
  });

  it("DENIES with no roles resolved under NODE_ENV=production", () => {
    // The whole point: a deployment that never wired role resolution must not
    // authorize every caller. Same fail-closed shape as resolveAuthMode.
    process.env.NODE_ENV = "production";
    process.env.ARM_FIXTURE_MODE = "0";
    const ctx = createContext({ claims });
    expect(() => requirePermission(ctx, "tool:publish")).toThrow(/refusing rather than/i);
  });

  it("still allows fixture mode in production — that is a demo, not a deployment", () => {
    process.env.NODE_ENV = "production";
    process.env.ARM_FIXTURE_MODE = "1";
    expect(() => requirePermission(createContext({ claims }), "tool:publish")).not.toThrow();
  });
});
