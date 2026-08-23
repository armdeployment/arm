import { describe, it, expect } from "vitest";
import { promoteCandidate, pinImportedVersion, assertExactUpstreamPin } from "../src/promote.js";

const BASE_INPUT = {
  candidateId: "cand-1",
  sourceId: "src-1",
  externalRef: "jira-mcp",
  proposedKind: "mcp" as const,
  name: "Jira MCP",
  description: "Issue tracking",
  tenantId: "tn-1",
  ownerUserId: "user-1",
  dataClassification: "internal" as const,
  slug: "jira-mcp",
};

describe("promoteCandidate (rule 2: draft + imported, provenance recorded)", () => {
  it("ALWAYS sets review_status draft and source_kind imported", () => {
    const c = promoteCandidate(BASE_INPUT);
    expect(c.review_status).toBe("draft");
    expect(c.source_kind).toBe("imported");
  });

  it("records provenance in source_ref (candidate id + source id + external ref)", () => {
    const c = promoteCandidate(BASE_INPUT);
    expect(c.source_ref).toContain("cand-1");
    expect(c.source_ref).toContain("src-1");
    expect(c.source_ref).toContain("jira-mcp");
  });

  it("carries through slug/kind/name/description/classification/tenant/owner", () => {
    const c = promoteCandidate(BASE_INPUT);
    expect(c.slug).toBe("jira-mcp");
    expect(c.kind).toBe("mcp");
    expect(c.name).toBe("Jira MCP");
    expect(c.tenant_id).toBe("tn-1");
    expect(c.owner_user_id).toBe("user-1");
    expect(c.data_classification).toBe("internal");
  });

  it("never produces review_status approved regardless of input shape", () => {
    // No input field can force approval — promoteCandidate's return type has
    // no approval-status parameter at all, only ever "draft".
    const c = promoteCandidate({ ...BASE_INPUT, name: "Anything" });
    expect(c.review_status).toBe("draft");
  });
});

describe("pinImportedVersion / assertExactUpstreamPin (rule 3: exact version + digest only)", () => {
  const GOOD_DIGEST = `sha256:${"a".repeat(64)}`;

  it("accepts an exact semver version + well-formed digest", () => {
    expect(() => assertExactUpstreamPin("1.2.3", GOOD_DIGEST)).not.toThrow();
  });

  it("rejects 'latest'", () => {
    expect(() => assertExactUpstreamPin("latest", GOOD_DIGEST)).toThrow(/mutable reference/);
  });

  it("rejects branch names (main/master/head/trunk)", () => {
    for (const branch of ["main", "master", "HEAD", "trunk"]) {
      expect(() => assertExactUpstreamPin(branch, GOOD_DIGEST)).toThrow(/mutable reference/);
    }
  });

  it("rejects a non-semver tag like 'v1.0.0' or 'release-42'", () => {
    expect(() => assertExactUpstreamPin("v1.0.0", GOOD_DIGEST)).toThrow(/not an exact semver/);
    expect(() => assertExactUpstreamPin("release-42", GOOD_DIGEST)).toThrow(/not an exact semver/);
  });

  it("rejects a malformed digest even with a valid version", () => {
    expect(() => assertExactUpstreamPin("1.0.0", "not-a-digest")).toThrow(/not a well-formed/);
    expect(() => assertExactUpstreamPin("1.0.0", "https://example.com/artifact.tar")).toThrow(/not a well-formed/);
  });

  it("pinImportedVersion returns a pinned row on valid input", () => {
    const pinned = pinImportedVersion({
      componentId: "comp-1",
      tenantId: "tn-1",
      upstreamVersion: "2.0.0",
      upstreamDigest: GOOD_DIGEST,
      manifest: { x: 1 },
      publishedBy: "user-1",
    });
    expect(pinned).toEqual({
      tenant_id: "tn-1",
      component_id: "comp-1",
      version: "2.0.0",
      manifest: { x: 1 },
      blob_digest: GOOD_DIGEST,
      published_by: "user-1",
    });
  });

  it("pinImportedVersion throws (does not silently coerce) on a 'latest' pin", () => {
    expect(() =>
      pinImportedVersion({
        componentId: "comp-1",
        tenantId: "tn-1",
        upstreamVersion: "latest",
        upstreamDigest: GOOD_DIGEST,
        manifest: {},
        publishedBy: "user-1",
      }),
    ).toThrow();
  });
});
