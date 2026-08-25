#!/usr/bin/env node
/**
 * Seed the live Postgres component / component_version / component_blob /
 * discovery_source / discovery_candidate tables with the same data
 * library-router.ts's fixture mode uses (Wave 3 DB wiring — see
 * docs/solutions/2026-08-25-wave3-catalog-router-postgres-wiring.md's "next
 * slice" note). Component data comes from @arm/artifactory's real fixtures
 * (componentFixtures/componentVersionFixtures/componentBlobFixtures);
 * discovery source/candidate rows are copied verbatim from
 * library-router.ts's local fixtures (not exported from any package).
 *
 * Usage: DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
 *          node scripts/dev/seed-postgres-library.mjs
 */
import { getDb, closeDb } from "../../packages/db/dist/index.js";
import {
  tenantTable,
  componentTable,
  componentVersionTable,
  componentBlobTable,
  discoverySourceTable,
  discoveryCandidateTable,
} from "../../packages/db/dist/schema/index.js";
import { componentFixtures, componentVersionFixtures, componentBlobFixtures, FIXTURE_TENANT_ID } from "../../packages/artifactory/dist/index.js";

const DISCOVERY_SOURCE = {
  id: "f0000000-0000-4000-8000-000000000001",
  kind: "mcp_registry",
  name: "Public MCP Registry",
  endpoint: "https://registry.modelcontextprotocol.io/index.json",
  authRef: null,
  enabled: true,
};

const DISCOVERY_CANDIDATE = {
  id: "f1000000-0000-4000-8000-000000000001",
  sourceId: "f0000000-0000-4000-8000-000000000001",
  externalRef: "example-external-connector",
  proposedKind: "http_api",
  name: "Example External Connector",
  description: "A discovered (not-yet-promoted) candidate from the public MCP registry — fixture data.",
  rawManifest: { name: "Example External Connector", description: "fixture" },
  status: "new",
};

const db = getDb();

console.log("Seeding tenant...");
await db.insert(tenantTable).values({
  id: FIXTURE_TENANT_ID,
  name: "Acme Manufacturing",
  tier: "pilot",
  deployment: "saas",
  industryProfile: "manufacturing",
}).onConflictDoNothing();

console.log(`Seeding ${componentFixtures.length} components...`);
for (const c of componentFixtures) {
  await db.insert(componentTable).values({
    id: c.id,
    tenantId: c.tenant_id,
    slug: c.slug,
    kind: c.kind,
    name: c.name,
    description: c.description,
    ownerUserId: c.owner_user_id,
    reviewStatus: c.review_status,
    sourceKind: c.source_kind,
    sourceRef: c.source_ref,
    endpoint: c.endpoint,
    authStrategy: c.auth_strategy,
    dataClassification: c.data_classification,
    homepageUrl: c.homepage_url,
  }).onConflictDoNothing();
}

console.log(`Seeding ${componentVersionFixtures.length} component versions...`);
for (const v of componentVersionFixtures) {
  await db.insert(componentVersionTable).values({
    id: v.id,
    tenantId: v.tenant_id,
    componentId: v.component_id,
    version: v.version,
    manifest: v.manifest,
    manifestSha256: v.manifest_sha256,
    blobDigest: v.blob_digest,
    blobSizeBytes: v.blob_size_bytes,
    blobMediaType: v.blob_media_type,
    configSchema: v.config_schema,
    requires: v.requires,
    changelog: v.changelog,
    yanked: v.yanked,
    publishedAt: v.published_at ? new Date(v.published_at) : null,
    publishedBy: v.published_by,
  }).onConflictDoNothing();
}

console.log(`Seeding ${componentBlobFixtures.length} component blobs...`);
for (const b of componentBlobFixtures) {
  await db.insert(componentBlobTable).values({
    digest: b.digest,
    tenantId: b.tenant_id,
    mediaType: b.media_type,
    sizeBytes: b.size_bytes,
    storageBackend: b.storage_backend,
    residency: b.residency,
    storageKey: b.storage_key,
    uploadedBy: b.uploaded_by,
  }).onConflictDoNothing();
}

console.log("Seeding 1 discovery source...");
await db.insert(discoverySourceTable).values({
  id: DISCOVERY_SOURCE.id,
  tenantId: FIXTURE_TENANT_ID,
  kind: DISCOVERY_SOURCE.kind,
  name: DISCOVERY_SOURCE.name,
  endpoint: DISCOVERY_SOURCE.endpoint,
  authRef: DISCOVERY_SOURCE.authRef,
  enabled: DISCOVERY_SOURCE.enabled,
}).onConflictDoNothing();

console.log("Seeding 1 discovery candidate...");
await db.insert(discoveryCandidateTable).values({
  id: DISCOVERY_CANDIDATE.id,
  tenantId: FIXTURE_TENANT_ID,
  sourceId: DISCOVERY_CANDIDATE.sourceId,
  externalRef: DISCOVERY_CANDIDATE.externalRef,
  proposedKind: DISCOVERY_CANDIDATE.proposedKind,
  name: DISCOVERY_CANDIDATE.name,
  description: DISCOVERY_CANDIDATE.description,
  rawManifest: DISCOVERY_CANDIDATE.rawManifest,
  status: DISCOVERY_CANDIDATE.status,
}).onConflictDoNothing();

await closeDb();
console.log("Seed complete.");
