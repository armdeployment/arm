/**
 * Library router (docs/guides/01-library-artifactory.md §7).
 *
 * Replaces the guide-00 placeholder. Wires `packages/artifactory`,
 * `packages/discovery`, `packages/catalog`, and `packages/profiles` behind
 * the frozen procedure names/shapes. `library` owns THIS file's contents
 * but not `packages/trpc/src/index.ts`'s router-registration block.
 *
 * FIXTURE DATA (matches the rest of this 1.0/D10 scaffold — see
 * `packages/trpc/src/index.ts`'s own header and
 * `packages/trpc/src/catalog-router.ts`): there is no live Postgres
 * connection anywhere in this repo yet. Every procedure here operates over
 * MUTABLE IN-MEMORY COPIES of `@arm/artifactory`'s component fixtures and
 * `@arm/catalog`'s package-version fixtures, exactly the pattern
 * `catalog-router.ts`'s `assignmentStore` already establishes.
 * Wave 3 replaced the in-memory stores with real Postgres reads/writes when
 * ARM_FIXTURE_MODE=0; the fixtures remain as the zero-configuration path.
 * `@arm/artifactory`'s `publishComponentVersion`/`ComponentRepoPort` and
 * `@arm/discovery`'s `syncSource`/`promoteCandidate` are already written
 * against injectable ports for exactly this swap.
 *
 * Every mutation emits an audit-log entry and returns an impact-preview
 * payload (the changed row(s) + the audit entry) — never a silent write.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { requirePermission, type ARMContext } from "./index.js";
import {
  isDemoMode,
  registerDemoArray,
  snapshotAllDemoStores,
  restoreAllDemoStores,
} from "./demo-mode.js";
import {
  componentKindSchema,
  discoveryCandidateStatusSchema,
  installedComponentRecordSchema,
  type Component,
  type ComponentVersion,
  type DiscoveryCandidate,
  type DiscoverySource,
  type InstalledComponentRecord,
} from "@arm/proto";
import { computeUpdatePlan, type RegistryComponent } from "./update-check.js";
import {
  componentFixtures,
  componentVersionFixtures,
  componentBlobFixtures,
  fixtureResolvableVersions,
  compareSemVer,
  publishComponentVersion,
  FsStorageBackend,
  type StorageBackend,
  type ComponentRepoPort,
  type ComponentRow,
  type BackendsByResidency,
  digestOf,
} from "@arm/artifactory";
import { packageVersionFixtures } from "@arm/catalog";
import { getProfile } from "@arm/profiles";
import { getDb } from "@arm/db";
import {
  componentTable,
  componentVersionTable,
  componentBlobTable,
  componentInstallTable,
  discoverySourceTable,
  discoveryCandidateTable,
  workPackageTable,
  workPackageVersionTable,
} from "@arm/db/schema";
import {
  searchInMemory,
  computeFacets,
  recommendForJobFunction,
  computeGaps,
  syncSource,
  promoteCandidate as buildPromotedComponent,
  type SearchableComponentRow,
  type SearchableWorkPackageRow,
  type RecommendCandidate,
} from "@arm/discovery";

/** ARM_FIXTURE_MODE (default "1" — ON), same pattern as adoption-router.ts
 *  and catalog-router.ts. Real mode reads/writes Postgres's component /
 *  component_version / component_blob / discovery_source /
 *  discovery_candidate tables (packages/db/src/schema/artifactory.ts) via
 *  a PostgresComponentRepoPort + a real FsStorageBackend, instead of the
 *  in-memory stores below. */
export function isFixtureMode(): boolean {
  return (process.env.ARM_FIXTURE_MODE ?? "1") !== "0";
}

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure
  .use(async (opts) => {
    const { ctx } = opts;
    if (!ctx.claims || !ctx.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
      });
    }
    return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
  })
  .use(async (opts) => {
    if (!isDemoMode() || opts.type !== "mutation") return opts.next();
    const snapshot = snapshotAllDemoStores();
    try {
      return await opts.next();
    } finally {
      restoreAllDemoStores(snapshot);
    }
  });

/**
 * `tool:publish` gate (D8/D9 verb, unrenamed — guide 00 §1). Real role
 * resolution now IS wired into `ARMContext` (`ctx.roles`), populated by the
 * caller from `@arm/auth`'s `resolveRolesFromGroups`.
 * Resolved 2026-09-01: `ARMContext` now carries `roles`, so this is a real
 * check rather than a comment describing one. `requirePermission` allows when
 * no roles were resolved at all in development — a fresh clone still works
 * with no configuration — and DENIES that same case under NODE_ENV=production,
 * so a deployment that has not wired role resolution fails closed instead of
 * authorizing every caller.
 */
function requireToolPublish(ctx: ARMContext): void {
  requirePermission(ctx, "tool:publish");
}

// ── In-memory stores (mutable copies of the shipped fixtures) ──────────────

const componentStore: Component[] = [...componentFixtures];
const componentVersionStore: ComponentVersion[] = [...componentVersionFixtures];
const componentBlobStore = [...componentBlobFixtures];

const FIXTURE_TENANT_ID = componentFixtures[0]!.tenant_id;

const discoverySourceStore: DiscoverySource[] = [
  {
    id: "f0000000-0000-4000-8000-000000000001",
    tenant_id: FIXTURE_TENANT_ID,
    kind: "mcp_registry",
    name: "Public MCP Registry",
    endpoint: "https://registry.modelcontextprotocol.io/index.json",
    auth_ref: null,
    enabled: true,
    last_synced_at: null,
  },
];

const discoveryCandidateStore: DiscoveryCandidate[] = [
  {
    id: "f1000000-0000-4000-8000-000000000001",
    tenant_id: FIXTURE_TENANT_ID,
    source_id: "f0000000-0000-4000-8000-000000000001",
    external_ref: "example-external-connector",
    proposed_kind: "http_api",
    name: "Example External Connector",
    description:
      "A discovered (not-yet-promoted) candidate from the public MCP registry — fixture data.",
    raw_manifest: { name: "Example External Connector", description: "fixture" },
    status: "new",
    promoted_component_id: null,
    first_seen_at: "2026-08-15T00:00:00",
    reviewed_by: null,
    reviewed_at: null,
  },
];

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
}
const auditLog: AuditEntry[] = [];

/** Fixture-mode inventory: one row per (sub_account, component), mirroring the
 *  `component_install` unique index so both modes converge the same way. */
interface InstallRow {
  tenant_id: string;
  sub_account_id: string;
  component_id: string;
  version: string;
  blob_digest: string | null;
  installed_path: string | null;
  client_version: string;
  installed_at: string;
  last_seen_at: string;
}
const componentInstallStore: InstallRow[] = [];

registerDemoArray(componentInstallStore);
registerDemoArray(componentStore);
registerDemoArray(componentVersionStore);
registerDemoArray(componentBlobStore);
registerDemoArray(discoveryCandidateStore);
registerDemoArray(auditLog);

function recordAudit(
  actor: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: string,
): AuditEntry {
  const entry: AuditEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    actor,
    action,
    targetType,
    targetId,
    detail,
  };
  auditLog.push(entry);
  return entry;
}

// ── In-memory StorageBackend (demo-only stand-in for publishVersion) ───────

/** A tiny in-process StorageBackend so `publishVersion` has something real
 *  to delegate to without touching the filesystem or a real object store —
 *  this router process is not the artifact-cache service (guide 01 §5). */
class InMemoryStorageBackend implements StorageBackend {
  readonly kind = "fs" as const;
  private readonly blobs = new Map<string, { body: Uint8Array; mediaType: string }>();

  async put(digest: string, body: Uint8Array, mediaType: string): Promise<void> {
    const computed = digestOf(body);
    if (computed !== digest) {
      throw new Error(
        `InMemoryStorageBackend: digest mismatch — declared ${digest}, computed ${computed}`,
      );
    }
    const existing = this.blobs.get(digest);
    if (existing && existing.body.byteLength === body.byteLength) return;
    this.blobs.set(digest, { body, mediaType });
  }
  async get(digest: string): Promise<Uint8Array> {
    const entry = this.blobs.get(digest);
    if (!entry) throw new Error(`InMemoryStorageBackend: no blob at ${digest}`);
    return entry.body;
  }
  async head(digest: string): Promise<{ size: number; mediaType: string } | null> {
    const entry = this.blobs.get(digest);
    return entry ? { size: entry.body.byteLength, mediaType: entry.mediaType } : null;
  }
  async presignGet(digest: string): Promise<string> {
    return `http://localhost:8790/artifacts/${encodeURIComponent(digest)}`;
  }
}
const inMemoryBackends: BackendsByResidency = {
  control_plane: new InMemoryStorageBackend(),
  tenant: new InMemoryStorageBackend(),
};

const componentRepo: ComponentRepoPort = {
  async getComponent(componentId: string): Promise<ComponentRow | null> {
    const c = componentStore.find((x) => x.id === componentId);
    return c
      ? { id: c.id, tenantId: c.tenant_id, slug: c.slug, reviewStatus: c.review_status }
      : null;
  },
  async getLatestVersion(componentId: string): Promise<{ version: string } | null> {
    const versions = componentVersionStore.filter(
      (v) => v.component_id === componentId && !v.yanked,
    );
    if (versions.length === 0) return null;
    return {
      version: [...versions].sort((a, b) => compareSemVer(b.version, a.version))[0]!.version,
    };
  },
  async versionExists(componentId: string, version: string): Promise<boolean> {
    return componentVersionStore.some(
      (v) => v.component_id === componentId && v.version === version,
    );
  },
  async insertVersionWithBlob(version, blob): Promise<{ id: string }> {
    const id = randomUUID();
    componentVersionStore.push({ ...version, id });
    if (blob) {
      componentBlobStore.push({
        digest: blob.digest,
        tenant_id: blob.residency === "control_plane" ? null : version.tenant_id,
        media_type: blob.mediaType,
        size_bytes: blob.sizeBytes,
        storage_backend: blob.storageBackend,
        residency: blob.residency,
        storage_key: blob.storageKey,
        uploaded_by: version.published_by,
      });
    }
    return { id };
  },
};

// ── Postgres real mode (Wave 3 DB wiring) ───────────────────────────────────
// packages/artifactory's publishComponentVersion/ComponentRepoPort was
// already written against an injectable port for exactly this swap (see the
// module doc header). realStorageBackends writes real files to disk —
// ARM_ARTIFACT_STORAGE_DIR (default ./data/artifacts) — a genuine content-
// addressed store, not a demo stand-in.

const realStorageBackends: BackendsByResidency = {
  control_plane: new FsStorageBackend({
    baseDir: process.env.ARM_ARTIFACT_STORAGE_DIR ?? "./data/artifacts/control-plane",
  }),
  tenant: new FsStorageBackend({
    baseDir: process.env.ARM_ARTIFACT_STORAGE_DIR ?? "./data/artifacts/tenant",
  }),
};

const postgresComponentRepo: ComponentRepoPort = {
  async getComponent(componentId: string): Promise<ComponentRow | null> {
    const db = getDb();
    const rows = await db.select().from(componentTable).where(eq(componentTable.id, componentId));
    const c = rows[0];
    return c
      ? { id: c.id, tenantId: c.tenantId, slug: c.slug, reviewStatus: c.reviewStatus }
      : null;
  },
  async getLatestVersion(componentId: string): Promise<{ version: string } | null> {
    const db = getDb();
    const versions = await db
      .select()
      .from(componentVersionTable)
      .where(
        and(
          eq(componentVersionTable.componentId, componentId),
          eq(componentVersionTable.yanked, false),
        ),
      );
    if (versions.length === 0) return null;
    return {
      version: [...versions].sort((a, b) => compareSemVer(b.version, a.version))[0]!.version,
    };
  },
  async versionExists(componentId: string, version: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .select()
      .from(componentVersionTable)
      .where(
        and(
          eq(componentVersionTable.componentId, componentId),
          eq(componentVersionTable.version, version),
        ),
      );
    return rows.length > 0;
  },
  async insertVersionWithBlob(version, blob): Promise<{ id: string }> {
    const db = getDb();
    const inserted = await db
      .insert(componentVersionTable)
      .values({
        tenantId: version.tenant_id,
        componentId: version.component_id,
        version: version.version,
        manifest: version.manifest,
        manifestSha256: version.manifest_sha256,
        blobDigest: version.blob_digest,
        blobSizeBytes: version.blob_size_bytes,
        blobMediaType: version.blob_media_type,
        configSchema: version.config_schema,
        requires: version.requires,
        changelog: version.changelog,
        yanked: version.yanked,
        publishedAt: version.published_at ? new Date(version.published_at) : null,
        publishedBy: version.published_by,
      })
      .returning();
    if (blob) {
      await db
        .insert(componentBlobTable)
        .values({
          digest: blob.digest,
          tenantId: blob.residency === "control_plane" ? null : version.tenant_id,
          mediaType: blob.mediaType,
          sizeBytes: blob.sizeBytes,
          storageBackend: blob.storageBackend,
          residency: blob.residency,
          storageKey: blob.storageKey,
          uploadedBy: version.published_by,
        })
        .onConflictDoNothing(); // content-addressed — same digest may already exist
    }
    return { id: inserted[0]!.id };
  },
};

function pgComponentToWire(row: typeof componentTable.$inferSelect): Component {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    description: row.description,
    owner_user_id: row.ownerUserId,
    review_status: row.reviewStatus,
    source_kind: row.sourceKind,
    source_ref: row.sourceRef,
    endpoint: row.endpoint,
    auth_strategy: row.authStrategy as Component["auth_strategy"],
    data_classification: row.dataClassification as Component["data_classification"],
    homepage_url: row.homepageUrl,
  };
}

/**
 * Load registry entries for exactly the components a client reported. Scoped
 * to those ids rather than the whole registry: a check-in should cost the same
 * whether the tenant publishes ten components or ten thousand.
 */
async function loadRegistryFor(
  tenantId: string,
  componentIds: string[],
): Promise<RegistryComponent[]> {
  if (componentIds.length === 0) return [];
  const wanted = new Set(componentIds);

  if (!isFixtureMode()) {
    const db = getDb();
    const [componentRows, versionRows] = await Promise.all([
      db.select().from(componentTable).where(eq(componentTable.tenantId, tenantId)),
      db.select().from(componentVersionTable).where(eq(componentVersionTable.tenantId, tenantId)),
    ]);
    return componentRows
      .filter((c) => wanted.has(c.id))
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        kind: c.kind,
        versions: versionRows
          .filter((v) => v.componentId === c.id)
          .map(pgVersionToComponentVersion),
      }));
  }

  return componentStore
    .filter((c) => c.tenant_id === tenantId && wanted.has(c.id))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      kind: c.kind,
      versions: componentVersionStore.filter((v) => v.component_id === c.id),
    }));
}

/**
 * Replace this agent's inventory with what it just reported.
 *
 * Replace, not merge: the report is the whole truth about that machine, so a
 * component the client no longer lists has been uninstalled and its row must
 * go. Merging would leave phantom rows that make an operator chase a component
 * nobody has any more.
 */
async function recordInventory(
  tenantId: string,
  subAccountId: string,
  clientVersion: string,
  components: InstalledComponentRecord[],
  checkedAt: string,
): Promise<void> {
  if (!isFixtureMode()) {
    const db = getDb();
    const reported = new Set(components.map((c) => c.component_id));
    const existing = await db
      .select()
      .from(componentInstallTable)
      .where(
        and(
          eq(componentInstallTable.tenantId, tenantId),
          eq(componentInstallTable.subAccountId, subAccountId),
        ),
      );
    for (const row of existing) {
      if (!reported.has(row.componentId)) {
        await db.delete(componentInstallTable).where(eq(componentInstallTable.id, row.id));
      }
    }
    for (const c of components) {
      const values = {
        tenantId,
        subAccountId,
        componentId: c.component_id,
        version: c.version,
        blobDigest: c.blob_digest,
        installedPath: c.installed_path,
        clientVersion,
        installedAt: new Date(c.installed_at),
        lastSeenAt: new Date(checkedAt),
      };
      await db
        .insert(componentInstallTable)
        .values(values)
        .onConflictDoUpdate({
          target: [componentInstallTable.subAccountId, componentInstallTable.componentId],
          set: {
            version: values.version,
            blobDigest: values.blobDigest,
            installedPath: values.installedPath,
            clientVersion: values.clientVersion,
            installedAt: values.installedAt,
            lastSeenAt: values.lastSeenAt,
          },
        });
    }
    return;
  }

  for (let i = componentInstallStore.length - 1; i >= 0; i--) {
    const row = componentInstallStore[i]!;
    if (row.tenant_id === tenantId && row.sub_account_id === subAccountId) {
      componentInstallStore.splice(i, 1);
    }
  }
  for (const c of components) {
    componentInstallStore.push({
      tenant_id: tenantId,
      sub_account_id: subAccountId,
      component_id: c.component_id,
      version: c.version,
      blob_digest: c.blob_digest,
      installed_path: c.installed_path,
      client_version: clientVersion,
      installed_at: c.installed_at,
      last_seen_at: checkedAt,
    });
  }
}

function pgVersionToComponentVersion(
  row: typeof componentVersionTable.$inferSelect,
): ComponentVersion {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    component_id: row.componentId,
    version: row.version,
    manifest: row.manifest,
    manifest_sha256: row.manifestSha256,
    blob_digest: row.blobDigest,
    blob_size_bytes: row.blobSizeBytes,
    blob_media_type: row.blobMediaType,
    config_schema: row.configSchema,
    requires: row.requires,
    changelog: row.changelog,
    yanked: row.yanked,
    published_at: row.publishedAt ? row.publishedAt.toISOString().slice(0, 19) : null,
    published_by: row.publishedBy,
  };
}

function pgSourceToWire(row: typeof discoverySourceTable.$inferSelect): DiscoverySource {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    kind: row.kind,
    name: row.name,
    endpoint: row.endpoint,
    auth_ref: row.authRef,
    enabled: row.enabled,
    last_synced_at: row.lastSyncedAt ? row.lastSyncedAt.toISOString().slice(0, 19) : null,
  };
}

function pgCandidateToWire(row: typeof discoveryCandidateTable.$inferSelect): DiscoveryCandidate {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    source_id: row.sourceId,
    external_ref: row.externalRef,
    proposed_kind: row.proposedKind,
    name: row.name,
    description: row.description,
    raw_manifest: row.rawManifest,
    status: row.status,
    promoted_component_id: row.promotedComponentId,
    first_seen_at: row.firstSeenAt.toISOString().slice(0, 19),
    reviewed_by: row.reviewedBy,
    reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString().slice(0, 19) : null,
  };
}

/** Real-mode derived signals — same "union of job_functions across pilot
 *  package versions that pin this component" logic as fixture mode, over
 *  real Postgres work_package_version rows instead of @arm/catalog's
 *  static fixtures (which real-mode catalog-router.ts mutations don't
 *  touch). */
async function derivedJobFunctionsForComponentPg(
  tenantId: string,
  componentId: string,
): Promise<string[]> {
  const db = getDb();
  const versions = await db
    .select()
    .from(workPackageVersionTable)
    .where(eq(workPackageVersionTable.tenantId, tenantId));
  const set = new Set<string>();
  for (const v of versions) {
    if (v.components.some((c) => c.componentId === componentId)) {
      for (const jf of v.jobFunctions) set.add(jf);
    }
  }
  return [...set].sort();
}

async function installCountForComponentPg(tenantId: string, componentId: string): Promise<number> {
  const db = getDb();
  const versions = await db
    .select()
    .from(workPackageVersionTable)
    .where(eq(workPackageVersionTable.tenantId, tenantId));
  return versions.filter((v) => v.components.some((c) => c.componentId === componentId)).length;
}

async function toSearchableComponentPg(
  tenantId: string,
  c: Component,
): Promise<SearchableComponentRow> {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    kind: c.kind,
    jobFunctions: await derivedJobFunctionsForComponentPg(tenantId, c.id),
    dataClassification: c.data_classification,
    sourceKind: c.source_kind,
    reviewStatus: c.review_status,
    installCount: await installCountForComponentPg(tenantId, c.id),
  };
}

// ── Derived (real, non-fabricated) signals over the fixture data ───────────

/** A component's job functions, derived as the UNION of job_functions across
 *  every pilot package version that pins it — no dedicated
 *  `component_job_function` fixture exists yet, so this is computed from
 *  real relationships rather than invented. */
function derivedJobFunctionsForComponent(componentId: string): string[] {
  const set = new Set<string>();
  for (const v of packageVersionFixtures) {
    if (v.components.some((c) => c.component_id === componentId)) {
      for (const jf of v.job_functions) set.add(jf);
    }
  }
  return [...set].sort();
}

/** How many pilot package versions pin this component — a real derived
 *  "install count" proxy (not a fabricated metric). */
function installCountForComponent(componentId: string): number {
  return packageVersionFixtures.filter((v) =>
    v.components.some((c) => c.component_id === componentId),
  ).length;
}

function toSearchableComponent(c: Component): SearchableComponentRow {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    kind: c.kind,
    jobFunctions: derivedJobFunctionsForComponent(c.id),
    dataClassification: c.data_classification,
    sourceKind: c.source_kind,
    reviewStatus: c.review_status,
    installCount: installCountForComponent(c.id),
  };
}

/**
 * Real-mode searchable work-package rows. Unlike the fixture-mode view
 * below, `work_package` IS reachable here (Wave 3 wired this router to
 * Postgres), so a version resolves to its package's real role_key / name /
 * mode / description instead of falling back to the version UUID. Without
 * this join the Library's Components tab rendered raw UUIDs as titles —
 * every package version showing as "40000000-0000-…" with no name.
 *
 * A version whose package row is missing is skipped rather than rendered
 * with a placeholder name: a dangling version is a data-integrity problem
 * to surface elsewhere, not something to paper over in search results.
 */
async function searchableWorkPackagesPg(
  db: ReturnType<typeof getDb>,
  tenantId: string,
): Promise<SearchableWorkPackageRow[]> {
  const [packageRows, versionRows] = await Promise.all([
    db.select().from(workPackageTable).where(eq(workPackageTable.tenantId, tenantId)),
    db.select().from(workPackageVersionTable).where(eq(workPackageVersionTable.tenantId, tenantId)),
  ]);
  const packageById = new Map(packageRows.map((p) => [p.id, p]));
  return versionRows.flatMap((v) => {
    const pkg = packageById.get(v.packageId);
    if (!pkg) return [];
    return [
      {
        id: v.id,
        roleKey: pkg.roleKey,
        name: pkg.name,
        description: pkg.description,
        mode: pkg.mode,
        jobFunctions: v.jobFunctions,
        installCount: 0,
      },
    ];
  });
}

function toSearchableWorkPackage(
  v: (typeof packageVersionFixtures)[number],
): SearchableWorkPackageRow {
  // NOTE: work_package (name/mode/role_key) lives in catalog-router.ts's
  // private fixtures, not exported from @arm/catalog — this router derives
  // a package-version-level view instead (role_key isn't available here,
  // so `id` doubles as the searchable slug for this fixture-mode view).
  return {
    id: v.id,
    roleKey: v.id,
    name: v.id,
    description: "",
    mode: "copilot",
    jobFunctions: v.job_functions,
    installCount: 0,
  };
}

// ── Router ───────────────────────────────────────────────────────────────

export const libraryRouter = t.router({
  // ── Component Registry ────────────────────────────────────────────────

  search: tenantProcedure
    .input(
      z.object({
        q: z.string().optional(),
        kinds: z.array(componentKindSchema).optional(),
        jobFunction: z.string().optional(),
        classification: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
        mode: z.enum(["automated", "copilot"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(100).default(20),
      }),
    )
    .query(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      if (!isFixtureMode()) {
        const db = getDb();
        const [compRows, packageRows] = await Promise.all([
          db.select().from(componentTable).where(eq(componentTable.tenantId, tenantId)),
          searchableWorkPackagesPg(db, tenantId),
        ]);
        const components = compRows.map(pgComponentToWire);
        const componentRows = await Promise.all(
          components.map((c) => toSearchableComponentPg(tenantId, c)),
        );
        const result = searchInMemory(componentRows, packageRows, opts.input);
        const facets = computeFacets(componentRows, packageRows);
        return { tenantId, items: result.items, facets, nextCursor: result.nextCursor };
      }
      const componentRows = componentStore.map(toSearchableComponent);
      const packageRows = packageVersionFixtures.map(toSearchableWorkPackage);
      const result = searchInMemory(componentRows, packageRows, opts.input);
      const facets = computeFacets(componentRows, packageRows);
      return { tenantId, items: result.items, facets, nextCursor: result.nextCursor };
    }),

  facets: tenantProcedure
    .input(z.object({ q: z.string().optional() }).default({}))
    .query(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      if (!isFixtureMode()) {
        const db = getDb();
        const [compRows, packageRows] = await Promise.all([
          db.select().from(componentTable).where(eq(componentTable.tenantId, tenantId)),
          searchableWorkPackagesPg(db, tenantId),
        ]);
        const components = compRows.map(pgComponentToWire);
        const componentRows = await Promise.all(
          components.map((c) => toSearchableComponentPg(tenantId, c)),
        );
        return { tenantId, facets: computeFacets(componentRows, packageRows) };
      }
      const componentRows = componentStore.map(toSearchableComponent);
      const packageRows = packageVersionFixtures.map(toSearchableWorkPackage);
      return { tenantId, facets: computeFacets(componentRows, packageRows) };
    }),

  getComponent: tenantProcedure.input(z.object({ slug: z.string() })).query(async (opts) => {
    const tenantId = opts.ctx.tenantId!;
    if (!isFixtureMode()) {
      const db = getDb();
      const compRows = await db
        .select()
        .from(componentTable)
        .where(
          and(eq(componentTable.slug, opts.input.slug), eq(componentTable.tenantId, tenantId)),
        );
      const compRow = compRows[0];
      if (!compRow)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Component "${opts.input.slug}" not found`,
        });
      const versionRows = await db
        .select()
        .from(componentVersionTable)
        .where(eq(componentVersionTable.componentId, compRow.id));
      const component = pgComponentToWire(compRow);
      return {
        tenantId,
        component,
        versions: versionRows
          .map(pgVersionToComponentVersion)
          .sort((a, b) => compareSemVer(b.version, a.version)),
        jobFunctions: await derivedJobFunctionsForComponentPg(tenantId, compRow.id),
        installCount: await installCountForComponentPg(tenantId, compRow.id),
      };
    }
    const component = componentStore.find((c) => c.slug === opts.input.slug);
    if (!component)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Component "${opts.input.slug}" not found`,
      });
    const versions = componentVersionStore
      .filter((v) => v.component_id === component.id)
      .sort((a, b) => compareSemVer(b.version, a.version));
    return {
      tenantId,
      component,
      versions,
      jobFunctions: derivedJobFunctionsForComponent(component.id),
      installCount: installCountForComponent(component.id),
    };
  }),

  listVersions: tenantProcedure
    .input(z.object({ componentId: z.string().uuid() }))
    .query(async (opts) => {
      if (!isFixtureMode()) {
        const db = getDb();
        const versionRows = await db
          .select()
          .from(componentVersionTable)
          .where(eq(componentVersionTable.componentId, opts.input.componentId));
        return {
          tenantId: opts.ctx.tenantId!,
          versions: versionRows
            .map(pgVersionToComponentVersion)
            .sort((a, b) => compareSemVer(b.version, a.version)),
        };
      }
      const versions = componentVersionStore
        .filter((v) => v.component_id === opts.input.componentId)
        .sort((a, b) => compareSemVer(b.version, a.version))
        .map((v) => ({ ...v, yanked: v.yanked }));
      return { tenantId: opts.ctx.tenantId!, versions };
    }),

  /**
   * The client reports its whole inventory; the server records it and answers
   * with what should be upgraded. One round trip closes both loops — the
   * operator learns which machine has which version, and the machine learns
   * what is stale — because two endpoints would let the two drift apart.
   *
   * The tenant comes from the authenticated context, never from the payload
   * (Invariant 6): a client that could name its own tenant could write
   * inventory rows into, and read update plans out of, someone else's.
   */
  checkIn: tenantProcedure
    .input(
      z.object({
        subAccountId: z.string().min(1),
        clientVersion: z.string().default(""),
        components: z.array(installedComponentRecordSchema).default([]),
      }),
    )
    .mutation(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      const { subAccountId, clientVersion, components } = opts.input;
      const checkedAt = new Date().toISOString();

      const registry = await loadRegistryFor(
        tenantId,
        components.map((c) => c.component_id),
      );
      const plan = computeUpdatePlan(components, registry, clientVersion);

      await recordInventory(tenantId, subAccountId, clientVersion, components, checkedAt);

      return {
        tenant_id: tenantId,
        sub_account_id: subAccountId,
        checked_at: checkedAt,
        updates: plan.updates,
        unknown: plan.unknown,
      };
    }),

  /** What a given agent install has on disk — the operator-facing side of
   *  `checkIn`. Empty until that machine has checked in at least once. */
  listInstalls: tenantProcedure
    .input(z.object({ subAccountId: z.string().min(1) }))
    .query(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      const { subAccountId } = opts.input;
      if (!isFixtureMode()) {
        const db = getDb();
        const rows = await db
          .select()
          .from(componentInstallTable)
          .where(
            and(
              eq(componentInstallTable.tenantId, tenantId),
              eq(componentInstallTable.subAccountId, subAccountId),
            ),
          );
        return {
          tenantId,
          subAccountId,
          installs: rows.map((r) => ({
            componentId: r.componentId,
            version: r.version,
            blobDigest: r.blobDigest,
            installedPath: r.installedPath,
            clientVersion: r.clientVersion,
            installedAt: r.installedAt.toISOString(),
            lastSeenAt: r.lastSeenAt.toISOString(),
          })),
        };
      }
      return {
        tenantId,
        subAccountId,
        installs: componentInstallStore
          .filter((r) => r.tenant_id === tenantId && r.sub_account_id === subAccountId)
          .map((r) => ({
            componentId: r.component_id,
            version: r.version,
            blobDigest: r.blob_digest,
            installedPath: r.installed_path,
            clientVersion: r.client_version,
            installedAt: r.installed_at,
            lastSeenAt: r.last_seen_at,
          })),
      };
    }),

  publishVersion: tenantProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
        manifest: z.record(z.string(), z.unknown()).default({}),
        configSchema: z.record(z.string(), z.unknown()).default({}),
        changelog: z.string().default(""),
        residency: z.enum(["control_plane", "tenant"]).default("tenant"),
      }),
    )
    .mutation(async (opts) => {
      requireToolPublish(opts.ctx);
      const result = await publishComponentVersion(
        {
          componentId: opts.input.componentId,
          tenantId: opts.ctx.tenantId!,
          version: opts.input.version,
          manifest: opts.input.manifest,
          configSchema: opts.input.configSchema,
          changelog: opts.input.changelog,
          publishedBy: opts.ctx.claims!.sub,
          residency: opts.input.residency,
          storageBackend: "fs",
        },
        {
          repo: isFixtureMode() ? componentRepo : postgresComponentRepo,
          backends: isFixtureMode() ? inMemoryBackends : realStorageBackends,
        },
      );
      // Audit trail is in-memory in both modes (no dedicated Postgres table
      // exists for it yet) — a lightweight observability record, not a
      // system of record.
      const audit = recordAudit(
        opts.ctx.claims!.sub,
        "publish_version",
        "component_version",
        `${result.componentId}@${result.version}`,
        `Published version ${result.version} (manifest_sha256=${result.manifestSha256})`,
      );
      return { tenantId: opts.ctx.tenantId!, ...result, audit };
    }),

  // ── Discovery ────────────────────────────────────────────────────────

  listSources: tenantProcedure.query(async (opts) => {
    const tenantId = opts.ctx.tenantId!;
    if (!isFixtureMode()) {
      const db = getDb();
      const rows = await db
        .select()
        .from(discoverySourceTable)
        .where(eq(discoverySourceTable.tenantId, tenantId));
      return { tenantId, sources: rows.map(pgSourceToWire) };
    }
    return { tenantId, sources: discoverySourceStore };
  }),

  listCandidates: tenantProcedure
    .input(z.object({ status: discoveryCandidateStatusSchema.optional() }).default({}))
    .query(async (opts) => {
      const tenantId = opts.ctx.tenantId!;
      if (!isFixtureMode()) {
        const db = getDb();
        const conditions = opts.input.status
          ? and(
              eq(discoveryCandidateTable.tenantId, tenantId),
              eq(discoveryCandidateTable.status, opts.input.status),
            )
          : eq(discoveryCandidateTable.tenantId, tenantId);
        const rows = await db.select().from(discoveryCandidateTable).where(conditions);
        return { tenantId, candidates: rows.map(pgCandidateToWire) };
      }
      return {
        tenantId,
        candidates: opts.input.status
          ? discoveryCandidateStore.filter((c) => c.status === opts.input.status)
          : discoveryCandidateStore,
      };
    }),

  promoteCandidate: tenantProcedure
    .input(
      z.object({
        candidateId: z.string().uuid(),
        slug: z.string().min(1),
        dataClassification: z
          .enum(["public", "internal", "confidential", "restricted"])
          .default("internal"),
      }),
    )
    .mutation(async (opts) => {
      requireToolPublish(opts.ctx);
      const tenantId = opts.ctx.tenantId!;
      if (!isFixtureMode()) {
        const db = getDb();
        const candidateRows = await db
          .select()
          .from(discoveryCandidateTable)
          .where(
            and(
              eq(discoveryCandidateTable.id, opts.input.candidateId),
              eq(discoveryCandidateTable.tenantId, tenantId),
            ),
          );
        const candidateRow = candidateRows[0];
        if (!candidateRow)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Candidate ${opts.input.candidateId} not found`,
          });
        const candidate = pgCandidateToWire(candidateRow);

        const promoted = buildPromotedComponent({
          candidateId: candidate.id,
          sourceId: candidate.source_id,
          externalRef: candidate.external_ref,
          proposedKind: candidate.proposed_kind,
          name: candidate.name,
          description: candidate.description,
          tenantId,
          ownerUserId: opts.ctx.claims!.sub,
          dataClassification: opts.input.dataClassification,
          slug: opts.input.slug,
        });
        const insertedComponent = (
          await db
            .insert(componentTable)
            .values({
              tenantId: promoted.tenant_id,
              slug: promoted.slug,
              kind: promoted.kind,
              name: promoted.name,
              description: promoted.description,
              ownerUserId: promoted.owner_user_id,
              reviewStatus: promoted.review_status,
              sourceKind: promoted.source_kind,
              sourceRef: promoted.source_ref,
              endpoint: promoted.endpoint,
              authStrategy: promoted.auth_strategy,
              dataClassification: promoted.data_classification,
              homepageUrl: promoted.homepage_url,
            })
            .returning()
        )[0]!;
        const newComponent = pgComponentToWire(insertedComponent);

        const updatedCandidate = (
          await db
            .update(discoveryCandidateTable)
            .set({
              status: "promoted",
              promotedComponentId: newComponent.id,
              reviewedBy: opts.ctx.claims!.sub,
              reviewedAt: new Date(),
            })
            .where(eq(discoveryCandidateTable.id, candidate.id))
            .returning()
        )[0]!;

        const audit = recordAudit(
          opts.ctx.claims!.sub,
          "promote_candidate",
          "discovery_candidate",
          candidate.id,
          `Promoted to draft component "${newComponent.slug}" (${newComponent.id}) — review_status=draft, source_kind=imported`,
        );
        return {
          tenantId,
          component: newComponent,
          candidate: pgCandidateToWire(updatedCandidate),
          audit,
        };
      }
      const candidate = discoveryCandidateStore.find((c) => c.id === opts.input.candidateId);
      if (!candidate)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Candidate ${opts.input.candidateId} not found`,
        });

      const promoted = buildPromotedComponent({
        candidateId: candidate.id,
        sourceId: candidate.source_id,
        externalRef: candidate.external_ref,
        proposedKind: candidate.proposed_kind,
        name: candidate.name,
        description: candidate.description,
        tenantId,
        ownerUserId: opts.ctx.claims!.sub,
        dataClassification: opts.input.dataClassification,
        slug: opts.input.slug,
      });
      const newComponent: Component = { id: randomUUID(), ...promoted };
      componentStore.push(newComponent);

      const idx = discoveryCandidateStore.findIndex((c) => c.id === candidate.id);
      discoveryCandidateStore[idx] = {
        ...candidate,
        status: "promoted",
        promoted_component_id: newComponent.id,
        reviewed_by: opts.ctx.claims!.sub,
        reviewed_at: new Date().toISOString().slice(0, 19),
      };

      const audit = recordAudit(
        opts.ctx.claims!.sub,
        "promote_candidate",
        "discovery_candidate",
        candidate.id,
        `Promoted to draft component "${newComponent.slug}" (${newComponent.id}) — review_status=draft, source_kind=imported`,
      );
      return { tenantId, component: newComponent, candidate: discoveryCandidateStore[idx], audit };
    }),

  rejectCandidate: tenantProcedure
    .input(z.object({ candidateId: z.string().uuid(), reason: z.string().default("") }))
    .mutation(async (opts) => {
      requireToolPublish(opts.ctx);
      const tenantId = opts.ctx.tenantId!;
      if (!isFixtureMode()) {
        const db = getDb();
        const existing = await db
          .select()
          .from(discoveryCandidateTable)
          .where(
            and(
              eq(discoveryCandidateTable.id, opts.input.candidateId),
              eq(discoveryCandidateTable.tenantId, tenantId),
            ),
          );
        if (!existing[0])
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Candidate ${opts.input.candidateId} not found`,
          });
        const updated = (
          await db
            .update(discoveryCandidateTable)
            .set({ status: "rejected", reviewedBy: opts.ctx.claims!.sub, reviewedAt: new Date() })
            .where(eq(discoveryCandidateTable.id, opts.input.candidateId))
            .returning()
        )[0]!;
        const audit = recordAudit(
          opts.ctx.claims!.sub,
          "reject_candidate",
          "discovery_candidate",
          updated.id,
          opts.input.reason || "Rejected without a stated reason",
        );
        return { tenantId, candidate: pgCandidateToWire(updated), audit };
      }
      const idx = discoveryCandidateStore.findIndex((c) => c.id === opts.input.candidateId);
      if (idx === -1)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Candidate ${opts.input.candidateId} not found`,
        });
      const current = discoveryCandidateStore[idx]!;
      discoveryCandidateStore[idx] = {
        ...current,
        status: "rejected",
        reviewed_by: opts.ctx.claims!.sub,
        reviewed_at: new Date().toISOString().slice(0, 19),
      };
      const audit = recordAudit(
        opts.ctx.claims!.sub,
        "reject_candidate",
        "discovery_candidate",
        current.id,
        opts.input.reason || "Rejected without a stated reason",
      );
      return { tenantId, candidate: discoveryCandidateStore[idx], audit };
    }),

  // ── Job functions ────────────────────────────────────────────────────

  listJobFunctions: tenantProcedure
    .input(z.object({ family: z.string().optional() }).default({}))
    .query(async (opts) => {
      // No per-tenant profile selection wired into ARMContext yet — the
      // fixture tenant across this whole scaffold is manufacturing-flavored
      // (see packages/trpc/src/index.ts's SCOPES/AGENTS fixtures).
      const jobFunctions = getProfile("manufacturing").jobFunctions.filter(
        (jf) => !opts.input.family || jf.functionFamily === opts.input.family,
      );
      const coverageByKey = new Map<string, number>();
      for (const v of packageVersionFixtures) {
        for (const key of v.job_functions)
          coverageByKey.set(key, (coverageByKey.get(key) ?? 0) + 1);
      }
      return {
        tenantId: opts.ctx.tenantId!,
        jobFunctions: jobFunctions.map((jf) => ({
          ...jf,
          packageCoverageCount: coverageByKey.get(jf.key) ?? 0,
        })),
      };
    }),

  recommendForJobFunction: tenantProcedure
    .input(z.object({ key: z.string() }))
    .query(async (opts) => {
      const componentCandidates: RecommendCandidate[] = componentStore.map((c) => ({
        slug: c.slug,
        jobFunctions: derivedJobFunctionsForComponent(c.id),
        reviewStatus: c.review_status,
        installCountByDepartment: {}, // no per-department install fixture exists yet — honest zero-signal
        publishedAt:
          componentVersionStore.find((v) => v.component_id === c.id)?.published_at ?? null,
      }));
      const packageCandidates: RecommendCandidate[] = packageVersionFixtures.map((v) => ({
        slug: v.id,
        jobFunctions: v.job_functions,
        reviewStatus: "approved", // work packages carry no review gate in this schema — packages are always eligible
        installCountByDepartment: {},
        publishedAt: null,
      }));
      return {
        tenantId: opts.ctx.tenantId!,
        components: recommendForJobFunction(componentCandidates, {
          jobFunctionKey: opts.input.key,
        }),
        packages: recommendForJobFunction(packageCandidates, { jobFunctionKey: opts.input.key }),
      };
    }),

  gaps: tenantProcedure.query(async (opts) => {
    const jobFunctions = getProfile("manufacturing").jobFunctions.map((jf) => ({
      key: jf.key,
      headcountWeight: jf.headcountWeight,
    }));
    const packages = packageVersionFixtures.map((v) => ({
      packageId: v.package_id,
      jobFunctions: v.job_functions,
    }));
    return { tenantId: opts.ctx.tenantId!, gaps: computeGaps(jobFunctions, packages) };
  }),
});

export type LibraryRouter = typeof libraryRouter;

// ── Exposed for testing only (worker-driven sync, guide 01 §6.2 rule 5 —
//    never called inline from a query/mutation procedure above). ──────────
export { syncSource, discoverySourceStore, discoveryCandidateStore, auditLog };
