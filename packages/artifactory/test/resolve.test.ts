import { describe, it, expect } from "vitest";
import { resolve, compareSemVer, satisfiesRange, type ResolvableComponentVersion } from "../src/resolve.js";

const TENANT = "tn-1";
const OTHER_TENANT = "tn-2";

function v(overrides: Partial<ResolvableComponentVersion>): ResolvableComponentVersion {
  return {
    componentId: "c1",
    slug: "jira",
    version: "1.0.0",
    yanked: false,
    tenantId: null,
    sourceKind: "first_party",
    ...overrides,
  };
}

describe("compareSemVer", () => {
  it("orders major, then minor, then patch", () => {
    expect(compareSemVer("1.0.0", "2.0.0")).toBeLessThan(0);
    expect(compareSemVer("2.1.0", "2.0.9")).toBeGreaterThan(0);
    expect(compareSemVer("1.2.3", "1.2.3")).toBe(0);
    expect(compareSemVer("1.2.4", "1.2.3")).toBeGreaterThan(0);
  });
});

describe("satisfiesRange", () => {
  it("matches an exact bare version only", () => {
    expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.4", "1.2.3")).toBe(false);
  });

  it("supports caret ranges (same major, >= base)", () => {
    expect(satisfiesRange("1.5.0", "^1.2.0")).toBe(true);
    expect(satisfiesRange("1.1.0", "^1.2.0")).toBe(false);
    expect(satisfiesRange("2.0.0", "^1.2.0")).toBe(false);
  });

  it("supports tilde ranges (same major.minor, >= base)", () => {
    expect(satisfiesRange("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfiesRange("1.3.0", "~1.2.0")).toBe(false);
  });

  it("supports >=, <=, >, < prefixes", () => {
    expect(satisfiesRange("2.0.0", ">=1.5.0")).toBe(true);
    expect(satisfiesRange("1.0.0", ">=1.5.0")).toBe(false);
    expect(satisfiesRange("1.0.0", "<=1.5.0")).toBe(true);
    expect(satisfiesRange("1.5.0", ">1.5.0")).toBe(false);
    expect(satisfiesRange("1.4.9", "<1.5.0")).toBe(true);
  });

  it("* matches any well-formed semver", () => {
    expect(satisfiesRange("9.9.9", "*")).toBe(true);
  });
});

describe("resolve", () => {
  it("picks the highest non-yanked version satisfying the range", () => {
    const versions = [
      v({ componentId: "c1", version: "1.0.0" }),
      v({ componentId: "c2", version: "1.5.0" }),
      v({ componentId: "c3", version: "2.0.0" }),
    ];
    const r = resolve("jira", "^1.0.0", versions, { tenantId: TENANT });
    expect(r).toEqual({ componentId: "c2", version: "1.5.0" });
  });

  it("returns null when no version satisfies the range", () => {
    const versions = [v({ version: "1.0.0" })];
    expect(resolve("jira", "^2.0.0", versions, { tenantId: TENANT })).toBeNull();
  });

  it("excludes yanked versions", () => {
    const versions = [
      v({ componentId: "c1", version: "2.0.0", yanked: true }),
      v({ componentId: "c2", version: "1.0.0", yanked: false }),
    ];
    const r = resolve("jira", "*", versions, { tenantId: TENANT });
    expect(r).toEqual({ componentId: "c2", version: "1.0.0" });
  });

  it("prefers the tenant's own component over the first-party fallback", () => {
    const versions = [
      v({ componentId: "first-party", version: "1.0.0", tenantId: null, sourceKind: "first_party" }),
      v({ componentId: "tenant-own", version: "1.0.0", tenantId: TENANT, sourceKind: "tenant_authored" }),
    ];
    const r = resolve("jira", "1.0.0", versions, { tenantId: TENANT });
    expect(r?.componentId).toBe("tenant-own");
  });

  it("falls back to first-party when the tenant has no own copy", () => {
    const versions = [
      v({ componentId: "first-party", version: "1.0.0", tenantId: null, sourceKind: "first_party" }),
      v({ componentId: "other-tenant", version: "1.0.0", tenantId: OTHER_TENANT, sourceKind: "tenant_authored" }),
    ];
    const r = resolve("jira", "1.0.0", versions, { tenantId: TENANT });
    expect(r?.componentId).toBe("first-party");
  });

  it("never returns a version belonging to a different tenant with no first-party fallback", () => {
    const versions = [v({ componentId: "other", version: "1.0.0", tenantId: OTHER_TENANT, sourceKind: "tenant_authored" })];
    expect(resolve("jira", "1.0.0", versions, { tenantId: TENANT })).toBeNull();
  });

  it("is a pure function over the supplied list (no external state)", () => {
    const versions = [v({ version: "1.0.0" })];
    const before = JSON.stringify(versions);
    resolve("jira", "1.0.0", versions, { tenantId: TENANT });
    expect(JSON.stringify(versions)).toBe(before);
  });
});
