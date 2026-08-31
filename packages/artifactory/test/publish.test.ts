import { describe, it, expect, beforeEach } from "vitest";
import {
  publishComponentVersion,
  type ComponentRepoPort,
  type ComponentRow,
  type BackendsByResidency,
} from "../src/publish.js";
import type { ComponentVersion } from "@arm/proto";
import { FsStorageBackend } from "../src/storage/fs.js";
import { digestOf } from "../src/digest.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** In-memory fake repo — no live DB anywhere in this repo yet (see file
 *  header of publish.ts); this is the same "fixture/port" pattern the rest
 *  of the codebase uses. */
class FakeComponentRepo implements ComponentRepoPort {
  components = new Map<string, ComponentRow>();
  versions: (ComponentVersion & { id: string })[] = [];
  nextId = 1;

  async getComponent(componentId: string): Promise<ComponentRow | null> {
    return this.components.get(componentId) ?? null;
  }

  async getLatestVersion(componentId: string): Promise<{ version: string } | null> {
    const mine = this.versions.filter((v) => v.component_id === componentId && !v.yanked);
    if (mine.length === 0) return null;
    // naive lexicographic-safe compare for x.y.z with single digits in tests
    mine.sort((a, b) => (a.version > b.version ? -1 : a.version < b.version ? 1 : 0));
    return { version: mine[0]!.version };
  }

  async versionExists(componentId: string, version: string): Promise<boolean> {
    return this.versions.some((v) => v.component_id === componentId && v.version === version);
  }

  async insertVersionWithBlob(version: Omit<ComponentVersion, "id">): Promise<{ id: string }> {
    const id = `cv-${this.nextId++}`;
    this.versions.push({ ...version, id });
    return { id };
  }
}

const TENANT = "11111111-1111-4111-8111-111111111111";
const COMPONENT_ID = "22222222-2222-4222-8222-222222222222";
const PUBLISHER = "33333333-3333-4333-8333-333333333333";

describe("publishComponentVersion", () => {
  let repo: FakeComponentRepo;
  let backends: BackendsByResidency;

  beforeEach(async () => {
    repo = new FakeComponentRepo();
    repo.components.set(COMPONENT_ID, {
      id: COMPONENT_ID,
      tenantId: TENANT,
      slug: "jira",
      reviewStatus: "approved",
    });
    const dir = await mkdtemp(join(tmpdir(), "arm-publish-test-"));
    backends = {
      tenant: new FsStorageBackend({ baseDir: dir }),
      control_plane: new FsStorageBackend({ baseDir: dir }),
    };
  });

  it("publishes a manifest-only (no blob) version successfully", async () => {
    const result = await publishComponentVersion(
      {
        componentId: COMPONENT_ID,
        tenantId: TENANT,
        version: "1.0.0",
        manifest: { base_url: "https://x" },
        publishedBy: PUBLISHER,
        residency: "tenant",
        storageBackend: "fs",
      },
      { repo, backends },
    );
    expect(result.componentId).toBe(COMPONENT_ID);
    expect(result.version).toBe("1.0.0");
    expect(result.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.blobDigest).toBeNull();
    expect(repo.versions).toHaveLength(1);
  });

  it("publishes a version WITH a blob, verifying the digest and storing it", async () => {
    const body = new TextEncoder().encode("skill content");
    const digest = digestOf(body);
    const result = await publishComponentVersion(
      {
        componentId: COMPONENT_ID,
        tenantId: TENANT,
        version: "1.0.0",
        manifest: {},
        publishedBy: PUBLISHER,
        residency: "tenant",
        storageBackend: "fs",
        blob: { body, mediaType: "text/markdown", declaredDigest: digest },
      },
      { repo, backends },
    );
    expect(result.blobDigest).toBe(digest);
    const stored = await backends.tenant.get(digest);
    expect(new TextDecoder().decode(stored)).toBe("skill content");
  });

  it("2. rejects when component.review_status !== 'approved'", async () => {
    repo.components.set(COMPONENT_ID, {
      id: COMPONENT_ID,
      tenantId: TENANT,
      slug: "jira",
      reviewStatus: "draft",
    });
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo, backends },
      ),
    ).rejects.toThrow(/not approved/);
  });

  it("rejects publishing against an unknown component", async () => {
    const wellFormedButUnknown = "99999999-9999-4999-8999-999999999999";
    await expect(
      publishComponentVersion(
        {
          componentId: wellFormedButUnknown,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo, backends },
      ),
    ).rejects.toThrow(/unknown component/);
  });

  it("3. rejects publishing a version that already exists (immutability)", async () => {
    await publishComponentVersion(
      {
        componentId: COMPONENT_ID,
        tenantId: TENANT,
        version: "1.0.0",
        manifest: {},
        publishedBy: PUBLISHER,
        residency: "tenant",
        storageBackend: "fs",
      },
      { repo, backends },
    );
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: { changed: true },
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo, backends },
      ),
    ).rejects.toThrow(/already exists/);
  });

  it("4. rejects a version not strictly greater than the latest published version", async () => {
    await publishComponentVersion(
      {
        componentId: COMPONENT_ID,
        tenantId: TENANT,
        version: "2.0.0",
        manifest: {},
        publishedBy: PUBLISHER,
        residency: "tenant",
        storageBackend: "fs",
      },
      { repo, backends },
    );
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.5.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo, backends },
      ),
    ).rejects.toThrow(/not strictly greater/);
  });

  it("accepts a version strictly greater than the latest", async () => {
    await publishComponentVersion(
      {
        componentId: COMPONENT_ID,
        tenantId: TENANT,
        version: "1.0.0",
        manifest: {},
        publishedBy: PUBLISHER,
        residency: "tenant",
        storageBackend: "fs",
      },
      { repo, backends },
    );
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.1.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo, backends },
      ),
    ).resolves.toBeDefined();
  });

  it("5. rejects when the declared blob digest does not match the actual bytes", async () => {
    const body = new TextEncoder().encode("real content");
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
          blob: { body, mediaType: "text/plain", declaredDigest: `sha256:${"0".repeat(64)}` },
        },
        { repo, backends },
      ),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects when the requested backend kind doesn't match the residency's registered backend", async () => {
    const body = new TextEncoder().encode("x");
    const digest = digestOf(body);
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "oci", // mismatched — the tenant backend registered below is fs
          blob: { body, mediaType: "text/plain", declaredDigest: digest },
        },
        { repo, backends }, // backends.tenant is still the fs backend from beforeEach
      ),
    ).rejects.toThrow(/does not match/);
  });

  it("fails loud (never stores a dangling reference) when the repo insert doesn't return an id", async () => {
    const brokenRepo: ComponentRepoPort = {
      ...repo,
      getComponent: repo.getComponent.bind(repo),
      getLatestVersion: repo.getLatestVersion.bind(repo),
      versionExists: repo.versionExists.bind(repo),
      insertVersionWithBlob: async () => ({ id: "" }),
    };
    await expect(
      publishComponentVersion(
        {
          componentId: COMPONENT_ID,
          tenantId: TENANT,
          version: "1.0.0",
          manifest: {},
          publishedBy: PUBLISHER,
          residency: "tenant",
          storageBackend: "fs",
        },
        { repo: brokenRepo, backends },
      ),
    ).rejects.toThrow(/no id/);
  });
});
