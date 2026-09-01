/**
 * Publish pipeline — validate → hash → store blob → insert version,
 * transactionally (guide 01 §2.2).
 *
 * There is no live DB client anywhere in this repo yet (every package/router
 * in the 1.0/D10 scaffold operates on injected or fixture data —
 * `packages/trpc/src/index.ts`'s own header, which used to read "FIXTURE DATA ... TODO(1.1):
 * replace with real Postgres/ClickHouse queries"). This pipeline follows the
 * same shape: it is written against a small `ComponentRepoPort` so it is
 * fully unit-testable today (an in-memory fake repo — see
 * `test/publish.test.ts`) and swaps in a real Drizzle-backed implementation
 * with no change to the orchestration logic once a live DB lands.
 *
 * Fail loud at every step — never store a dangling reference (the M5 rule
 * already stated in `packages/catalog/src/provision.ts`).
 */

import { componentVersionSchema, type ComponentVersion } from "@arm/proto";
import type { StorageBackend } from "./storage/backend.js";
import { digestOf, assertDigestMatches } from "./digest.js";
import { componentManifestSha256 } from "./manifest.js";
import { compareSemVer } from "./resolve.js";

export interface ComponentRow {
  id: string;
  tenantId: string;
  slug: string;
  reviewStatus: string;
}

export interface ComponentRepoPort {
  getComponent(componentId: string): Promise<ComponentRow | null>;
  /** Highest non-yanked published version currently on record, if any. */
  getLatestVersion(componentId: string): Promise<{ version: string } | null>;
  versionExists(componentId: string, version: string): Promise<boolean>;
  /**
   * Insert the component_version row and (if present) upsert the
   * component_blob row, in ONE transaction. Implementations must roll back
   * both writes together on any failure.
   */
  insertVersionWithBlob(
    version: Omit<ComponentVersion, "id">,
    blob: {
      digest: string;
      sizeBytes: number;
      mediaType: string;
      residency: "control_plane" | "tenant";
      storageBackend: "fs" | "s3" | "oci";
      storageKey: string;
    } | null,
  ): Promise<{ id: string }>;
}

export interface PublishBlobInput {
  body: Uint8Array;
  mediaType: string;
  /** Digest the caller claims for `body` — MUST match the recomputed sha256. */
  declaredDigest: string;
}

export interface PublishComponentVersionInput {
  componentId: string;
  tenantId: string;
  version: string;
  manifest: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  requires?: { component_slug: string; range: string }[];
  changelog?: string;
  publishedBy: string;
  /** `control_plane` only valid for first_party components — the caller
   *  (the tRPC procedure / a future publish worker) decides residency from
   *  `component.source_kind`; this function does not re-derive it, but
   *  `blob-residency` guardrail polices the invariant on stored rows. */
  residency: "control_plane" | "tenant";
  storageBackend: "fs" | "s3" | "oci";
  blob?: PublishBlobInput;
}

export interface PublishResult {
  componentId: string;
  version: string;
  manifestSha256: string;
  blobDigest: string | null;
}

/** Storage backends keyed by residency — publish picks the backend for the
 *  blob's residency, never a hardcoded one. */
export type BackendsByResidency = Record<"control_plane" | "tenant", StorageBackend>;

export async function publishComponentVersion(
  input: PublishComponentVersionInput,
  deps: { repo: ComponentRepoPort; backends: BackendsByResidency },
): Promise<PublishResult> {
  // 1. zod-validate the manifest shape via componentVersionSchema (partial:
  //    we validate the fields we're about to construct, not a full row yet —
  //    the full row is validated again by the repo/DB layer on insert).
  const manifestSha256 = componentManifestSha256(input.manifest);
  const candidateVersionRow = componentVersionSchema
    .omit({
      id: true,
      blob_digest: true,
      blob_size_bytes: true,
      blob_media_type: true,
      published_at: true,
      published_by: true,
    })
    .safeParse({
      tenant_id: input.tenantId,
      component_id: input.componentId,
      version: input.version,
      manifest: input.manifest,
      manifest_sha256: manifestSha256,
      config_schema: input.configSchema ?? {},
      requires: input.requires ?? [],
      changelog: input.changelog ?? "",
      yanked: false,
    });
  if (!candidateVersionRow.success) {
    throw new Error(
      `publishComponentVersion: manifest failed schema validation: ${candidateVersionRow.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  // 2. reject if component.review_status !== "approved" (component-review guard)
  const component = await deps.repo.getComponent(input.componentId);
  if (component === null) {
    throw new Error(`publishComponentVersion: unknown component "${input.componentId}"`);
  }
  if (component.reviewStatus !== "approved") {
    throw new Error(
      `publishComponentVersion: component "${input.componentId}" (${component.slug}) is not approved ` +
        `(review_status="${component.reviewStatus}") — publish blocked by the component-review gate`,
    );
  }

  // 3. reject if version already exists (immutability)
  if (await deps.repo.versionExists(input.componentId, input.version)) {
    throw new Error(
      `publishComponentVersion: version ${input.version} of component "${input.componentId}" already exists ` +
        `— component_version rows are immutable; ship a new version instead`,
    );
  }

  // 4. reject if semver is not strictly greater than the latest non-yanked version
  const latest = await deps.repo.getLatestVersion(input.componentId);
  if (latest !== null && compareSemVer(input.version, latest.version) <= 0) {
    throw new Error(
      `publishComponentVersion: version ${input.version} is not strictly greater than the latest ` +
        `published version ${latest.version} of component "${input.componentId}"`,
    );
  }

  // 5. if a blob is supplied: compute digest, assert declared === computed,
  //    pick backend by residency, put(), upsert component_blob
  let blobDigest: string | null = null;
  let blobRow: {
    digest: string;
    sizeBytes: number;
    mediaType: string;
    residency: "control_plane" | "tenant";
    storageBackend: "fs" | "s3" | "oci";
    storageKey: string;
  } | null = null;
  if (input.blob) {
    const computed = digestOf(input.blob.body);
    if (computed !== input.blob.declaredDigest) {
      throw new Error(
        `publishComponentVersion: declared blob digest ${input.blob.declaredDigest} does not match ` +
          `computed digest ${computed} — refusing to publish a mismatched artifact`,
      );
    }
    assertDigestMatches(computed, input.blob.body);
    const backend = deps.backends[input.residency];
    if (backend.kind !== input.storageBackend) {
      throw new Error(
        `publishComponentVersion: requested storageBackend "${input.storageBackend}" does not match ` +
          `the backend registered for residency "${input.residency}" (kind "${backend.kind}")`,
      );
    }
    await backend.put(computed, input.blob.body, input.blob.mediaType);
    blobDigest = computed;
    blobRow = {
      digest: computed,
      sizeBytes: input.blob.body.byteLength,
      mediaType: input.blob.mediaType,
      residency: input.residency,
      storageBackend: input.storageBackend,
      storageKey: computed,
    };
  }

  // 6. manifest_sha256 already computed above (step 1) over the canonical manifest.

  // 7. insert component_version in ONE transaction with the blob row
  const inserted = await deps.repo.insertVersionWithBlob(
    {
      tenant_id: input.tenantId,
      component_id: input.componentId,
      version: input.version,
      manifest: input.manifest,
      manifest_sha256: manifestSha256,
      blob_digest: blobDigest,
      blob_size_bytes: input.blob ? input.blob.body.byteLength : null,
      blob_media_type: input.blob ? input.blob.mediaType : null,
      config_schema: input.configSchema ?? {},
      requires: input.requires ?? [],
      changelog: input.changelog ?? "",
      yanked: false,
      published_at: new Date().toISOString().slice(0, 19),
      published_by: input.publishedBy,
    },
    blobRow,
  );
  if (!inserted?.id) {
    // Never leave a blob written with no referencing row — fail loud (M5).
    throw new Error(
      "publishComponentVersion: insertVersionWithBlob returned no id — refusing to leave a dangling blob reference",
    );
  }

  // 8. return { componentId, version, manifestSha256, blobDigest }
  return { componentId: input.componentId, version: input.version, manifestSha256, blobDigest };
}
