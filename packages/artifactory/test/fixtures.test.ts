import { describe, it, expect } from "vitest";
import {
  componentFixtures,
  componentVersionFixtures,
  componentBlobFixtures,
  fixtureResolvableVersions,
  componentFixturesBySlug,
} from "../src/fixtures.js";
import { componentSchema, componentVersionSchema, componentBlobSchema } from "@arm/proto";
import { componentManifestSha256 } from "../src/manifest.js";
import { resolve } from "../src/resolve.js";

describe("artifactory fixtures", () => {
  it("every component fixture parses against componentSchema", () => {
    for (const c of componentFixtures) {
      const parsed = componentSchema.safeParse(c);
      expect(parsed.success, JSON.stringify(parsed.success ? {} : parsed.error.issues)).toBe(true);
    }
  });

  it("every component version fixture parses against componentVersionSchema", () => {
    for (const v of componentVersionFixtures) {
      const parsed = componentVersionSchema.safeParse(v);
      expect(parsed.success, JSON.stringify(parsed.success ? {} : parsed.error.issues)).toBe(true);
    }
  });

  it("every component blob fixture parses against componentBlobSchema", () => {
    for (const b of componentBlobFixtures) {
      const parsed = componentBlobSchema.safeParse(b);
      expect(parsed.success, JSON.stringify(parsed.success ? {} : parsed.error.issues)).toBe(true);
    }
  });

  it("component slugs are unique", () => {
    const slugs = componentFixtures.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has 40 callable components (mcp/http_api/cli/connector) + installable + 1 tenant-authored", () => {
    const callable = componentFixtures.filter((c) =>
      ["mcp", "http_api", "cli", "connector"].includes(c.kind),
    );
    expect(callable).toHaveLength(40);
    const installable = componentFixtures.filter((c) =>
      ["skill", "subagent", "template"].includes(c.kind),
    );
    expect(installable.length).toBeGreaterThanOrEqual(38);
    const tenantAuthored = componentFixtures.filter((c) => c.source_kind === "tenant_authored");
    expect(tenantAuthored).toHaveLength(1);
  });

  it("every component_version references an existing component (no dangling refs)", () => {
    const ids = new Set(componentFixtures.map((c) => c.id));
    for (const v of componentVersionFixtures) {
      expect(ids.has(v.component_id), `version ${v.id} dangles on ${v.component_id}`).toBe(true);
    }
  });

  it("component_version ids are unique", () => {
    const ids = componentVersionFixtures.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("(component_id, version) pairs are unique (immutability substrate)", () => {
    const pairs = componentVersionFixtures.map((v) => `${v.component_id}@${v.version}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("manifest_sha256 recomputes correctly for every version", () => {
    for (const v of componentVersionFixtures) {
      expect(v.manifest_sha256).toBe(componentManifestSha256(v.manifest));
    }
  });

  it("cli-kind components use a cli:// endpoint", () => {
    for (const c of componentFixtures.filter((c) => c.kind === "cli")) {
      expect(c.endpoint?.startsWith("cli://"), `${c.slug}: ${c.endpoint}`).toBe(true);
    }
  });

  it("confidential/restricted callable components never use auth_strategy none — except local cli apps", () => {
    for (const c of componentFixtures) {
      if (
        (c.data_classification === "confidential" || c.data_classification === "restricted") &&
        c.auth_strategy === "none"
      ) {
        expect(
          c.kind,
          `${c.slug} classified ${c.data_classification} with auth_strategy none must be cli`,
        ).toBe("cli");
      }
    }
  });

  it("installable (skill/subagent/template/plugin/prompt_pack) components have no endpoint/auth_strategy", () => {
    for (const c of componentFixtures) {
      if (["skill", "subagent", "template", "plugin", "prompt_pack"].includes(c.kind)) {
        expect(c.endpoint, c.slug).toBeNull();
        expect(c.auth_strategy, c.slug).toBeNull();
      }
    }
  });

  it("every blob fixture is referenced by at least one component_version, and vice versa for versions with a blob_digest", () => {
    const blobDigests = new Set(componentBlobFixtures.map((b) => b.digest));
    const versionDigests = new Set(
      componentVersionFixtures
        .filter((v) => v.blob_digest !== null)
        .map((v) => v.blob_digest as string),
    );
    for (const d of versionDigests) {
      expect(
        blobDigests.has(d),
        `version references blob ${d} with no component_blob fixture`,
      ).toBe(true);
    }
    for (const d of blobDigests) {
      expect(versionDigests.has(d), `blob ${d} has no referencing component_version`).toBe(true);
    }
  });

  it("the tenant-authored component's blob has residency 'tenant', never 'control_plane' (Invariant 1)", () => {
    const tenantAuthored = componentFixtures.filter((c) => c.source_kind === "tenant_authored");
    for (const c of tenantAuthored) {
      const versions = componentVersionFixtures.filter(
        (v) => v.component_id === c.id && v.blob_digest !== null,
      );
      for (const v of versions) {
        const blob = componentBlobFixtures.find((b) => b.digest === v.blob_digest);
        expect(blob?.residency).toBe("tenant");
      }
    }
  });

  it("fixtureResolvableVersions has one entry per component_version fixture", () => {
    expect(fixtureResolvableVersions).toHaveLength(componentVersionFixtures.length);
  });

  it("resolve() finds real fixture components by slug", () => {
    const r = resolve("jira", "1.0.0", fixtureResolvableVersions, {
      tenantId: "any-tenant-falls-back-to-first-party",
    });
    expect(r?.componentId).toBe(componentFixturesBySlug["jira"]?.id);
  });

  it("resolve() finds the tenant-authored component only for its own tenant", () => {
    const own = resolve("internal-process-notes", "1.0.0", fixtureResolvableVersions, {
      tenantId: componentFixturesBySlug["internal-process-notes"]!.tenant_id,
    });
    expect(own).not.toBeNull();
    const other = resolve("internal-process-notes", "1.0.0", fixtureResolvableVersions, {
      tenantId: "some-other-tenant",
    });
    expect(other).toBeNull(); // no first-party fallback for tenant-authored content
  });

  it("componentFixturesBySlug covers every fixture", () => {
    expect(Object.keys(componentFixturesBySlug)).toHaveLength(componentFixtures.length);
  });
});
