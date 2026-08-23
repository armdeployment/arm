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
 * TODO(1.1): replace the in-memory stores with real Postgres reads/writes;
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
import type { ARMContext } from "./index.js";
import {
  componentKindSchema,
  discoveryCandidateStatusSchema,
  type Component,
  type ComponentVersion,
  type DiscoveryCandidate,
  type DiscoverySource,
} from "@arm/proto";
import {
  componentFixtures,
  componentVersionFixtures,
  componentBlobFixtures,
  fixtureResolvableVersions,
  compareSemVer,
  publishComponentVersion,
  type StorageBackend,
  type ComponentRepoPort,
  type ComponentRow,
  type BackendsByResidency,
  digestOf,
} from "@arm/artifactory";
import { packageVersionFixtures } from "@arm/catalog";
import { getProfile } from "@arm/profiles";
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

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
});

/**
 * `tool:publish` gate (D8/D9 verb, unrenamed — guide 00 §1). Real role
 * resolution isn't wired into `ARMContext` yet anywhere in this codebase
 * (every tenantProcedure in `catalog-router.ts`/`index.ts` is similarly
 * "dev mode always authorized" pending a real RBAC context — see
 * `orgTreeRouter.mutate`'s identical note in `packages/trpc/src/index.ts`).
 * TODO(1.1): call `@arm/auth`'s `hasPermission(resolvedRoles, "tool:publish")`
 * once `ARMContext` carries resolved roles.
 */
function requireToolPublish(): void {
  // dev mode: always authorized. Production: real RBAC check here.
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
    description: "A discovered (not-yet-promoted) candidate from the public MCP registry — fixture data.",
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

function recordAudit(actor: string, action: string, targetType: string, targetId: string, detail: string): AuditEntry {
  const entry: AuditEntry = { id: randomUUID(), ts: new Date().toISOString(), actor, action, targetType, targetId, detail };
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
      throw new Error(`InMemoryStorageBackend: digest mismatch — declared ${digest}, computed ${computed}`);
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
    return c ? { id: c.id, tenantId: c.tenant_id, slug: c.slug, reviewStatus: c.review_status } : null;
  },
  async getLatestVersion(componentId: string): Promise<{ version: string } | null> {
    const versions = componentVersionStore.filter((v) => v.component_id === componentId && !v.yanked);
    if (versions.length === 0) return null;
    return { version: [...versions].sort((a, b) => compareSemVer(b.version, a.version))[0]!.version };
  },
  async versionExists(componentId: string, version: string): Promise<boolean> {
    return componentVersionStore.some((v) => v.component_id === componentId && v.version === version);
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
  return packageVersionFixtures.filter((v) => v.components.some((c) => c.component_id === componentId)).length;
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

function toSearchableWorkPackage(v: (typeof packageVersionFixtures)[number]): SearchableWorkPackageRow {
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
      const componentRows = componentStore.map(toSearchableComponent);
      const packageRows = packageVersionFixtures.map(toSearchableWorkPackage);
      const result = searchInMemory(componentRows, packageRows, opts.input);
      const facets = computeFacets(componentRows, packageRows);
      return { tenantId: opts.ctx.tenantId!, items: result.items, facets, nextCursor: result.nextCursor };
    }),

  facets: tenantProcedure.input(z.object({ q: z.string().optional() }).default({})).query(async (opts) => {
    const componentRows = componentStore.map(toSearchableComponent);
    const packageRows = packageVersionFixtures.map(toSearchableWorkPackage);
    return { tenantId: opts.ctx.tenantId!, facets: computeFacets(componentRows, packageRows) };
  }),

  getComponent: tenantProcedure.input(z.object({ slug: z.string() })).query(async (opts) => {
    const component = componentStore.find((c) => c.slug === opts.input.slug);
    if (!component) throw new TRPCError({ code: "NOT_FOUND", message: `Component "${opts.input.slug}" not found` });
    const versions = componentVersionStore
      .filter((v) => v.component_id === component.id)
      .sort((a, b) => compareSemVer(b.version, a.version));
    return {
      tenantId: opts.ctx.tenantId!,
      component,
      versions,
      jobFunctions: derivedJobFunctionsForComponent(component.id),
      installCount: installCountForComponent(component.id),
    };
  }),

  listVersions: tenantProcedure.input(z.object({ componentId: z.string().uuid() })).query(async (opts) => {
    const versions = componentVersionStore
      .filter((v) => v.component_id === opts.input.componentId)
      .sort((a, b) => compareSemVer(b.version, a.version))
      .map((v) => ({ ...v, yanked: v.yanked }));
    return { tenantId: opts.ctx.tenantId!, versions };
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
      requireToolPublish();
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
        { repo: componentRepo, backends: inMemoryBackends },
      );
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

  listSources: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    sources: discoverySourceStore,
  })),

  listCandidates: tenantProcedure
    .input(z.object({ status: discoveryCandidateStatusSchema.optional() }).default({}))
    .query(async (opts) => ({
      tenantId: opts.ctx.tenantId!,
      candidates: opts.input.status
        ? discoveryCandidateStore.filter((c) => c.status === opts.input.status)
        : discoveryCandidateStore,
    })),

  promoteCandidate: tenantProcedure
    .input(z.object({ candidateId: z.string().uuid(), slug: z.string().min(1), dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal") }))
    .mutation(async (opts) => {
      requireToolPublish();
      const candidate = discoveryCandidateStore.find((c) => c.id === opts.input.candidateId);
      if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: `Candidate ${opts.input.candidateId} not found` });

      const promoted = buildPromotedComponent({
        candidateId: candidate.id,
        sourceId: candidate.source_id,
        externalRef: candidate.external_ref,
        proposedKind: candidate.proposed_kind,
        name: candidate.name,
        description: candidate.description,
        tenantId: opts.ctx.tenantId!,
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
      return { tenantId: opts.ctx.tenantId!, component: newComponent, candidate: discoveryCandidateStore[idx], audit };
    }),

  rejectCandidate: tenantProcedure
    .input(z.object({ candidateId: z.string().uuid(), reason: z.string().default("") }))
    .mutation(async (opts) => {
      requireToolPublish();
      const idx = discoveryCandidateStore.findIndex((c) => c.id === opts.input.candidateId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: `Candidate ${opts.input.candidateId} not found` });
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
      return { tenantId: opts.ctx.tenantId!, candidate: discoveryCandidateStore[idx], audit };
    }),

  // ── Job functions ────────────────────────────────────────────────────

  listJobFunctions: tenantProcedure.input(z.object({ family: z.string().optional() }).default({})).query(async (opts) => {
    // No per-tenant profile selection wired into ARMContext yet — the
    // fixture tenant across this whole scaffold is manufacturing-flavored
    // (see packages/trpc/src/index.ts's SCOPES/AGENTS fixtures).
    const jobFunctions = getProfile("manufacturing").jobFunctions.filter(
      (jf) => !opts.input.family || jf.functionFamily === opts.input.family,
    );
    const coverageByKey = new Map<string, number>();
    for (const v of packageVersionFixtures) {
      for (const key of v.job_functions) coverageByKey.set(key, (coverageByKey.get(key) ?? 0) + 1);
    }
    return {
      tenantId: opts.ctx.tenantId!,
      jobFunctions: jobFunctions.map((jf) => ({ ...jf, packageCoverageCount: coverageByKey.get(jf.key) ?? 0 })),
    };
  }),

  recommendForJobFunction: tenantProcedure.input(z.object({ key: z.string() })).query(async (opts) => {
    const componentCandidates: RecommendCandidate[] = componentStore.map((c) => ({
      slug: c.slug,
      jobFunctions: derivedJobFunctionsForComponent(c.id),
      reviewStatus: c.review_status,
      installCountByDepartment: {}, // no per-department install fixture exists yet — honest zero-signal
      publishedAt: componentVersionStore.find((v) => v.component_id === c.id)?.published_at ?? null,
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
      components: recommendForJobFunction(componentCandidates, { jobFunctionKey: opts.input.key }),
      packages: recommendForJobFunction(packageCandidates, { jobFunctionKey: opts.input.key }),
    };
  }),

  gaps: tenantProcedure.query(async (opts) => {
    const jobFunctions = getProfile("manufacturing").jobFunctions.map((jf) => ({ key: jf.key, headcountWeight: jf.headcountWeight }));
    const packages = packageVersionFixtures.map((v) => ({ packageId: v.package_id, jobFunctions: v.job_functions }));
    return { tenantId: opts.ctx.tenantId!, gaps: computeGaps(jobFunctions, packages) };
  }),
});

export type LibraryRouter = typeof libraryRouter;

// ── Exposed for testing only (worker-driven sync, guide 01 §6.2 rule 5 —
//    never called inline from a query/mutation procedure above). ──────────
export { syncSource, discoverySourceStore, discoveryCandidateStore, auditLog };
