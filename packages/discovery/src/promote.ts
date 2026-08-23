/**
 * Candidate → component (draft), with provenance recorded (guide 01 §6.2).
 *
 * Rule 2 (non-negotiable, tested): `promoteCandidate` ALWAYS creates the
 * component with `review_status = 'draft'` and `source_kind = 'imported'`,
 * recording `source_ref`. Publishing still requires the normal approval
 * path — the `component-review` guardrail blocks any package from pinning
 * an unapproved component, imported or not. There is no shortcut here to
 * `approved`.
 *
 * Rule 3 (non-negotiable, tested): `pinImportedVersion` only accepts an
 * EXACT semver upstream version (`\d+\.\d+\.\d+`, matching
 * `componentVersionSchema.version`) and a well-formed `sha256:<hex>`
 * digest — never a tag, branch, or `latest`.
 */

import type { ComponentKind, ComponentReviewStatus, ComponentSourceKind } from "@arm/proto";
import { DIGEST_RE } from "@arm/artifactory";

const EXACT_SEMVER_RE = /^\d+\.\d+\.\d+$/;
/** Common mutable-reference literals we explicitly reject with a clear
 *  message (defense in depth — EXACT_SEMVER_RE already rejects all of
 *  these, but a named check gives a much better error than a generic
 *  "not a valid version" for the most common mistakes). */
const KNOWN_MUTABLE_REFS = new Set(["latest", "main", "master", "head", "trunk", "stable"]);

export interface PromoteCandidateInput {
  candidateId: string;
  sourceId: string;
  externalRef: string;
  proposedKind: ComponentKind;
  name: string;
  description: string;
  tenantId: string;
  ownerUserId: string;
  dataClassification: "public" | "internal" | "confidential" | "restricted";
  slug: string;
}

export interface PromotedComponent {
  tenant_id: string;
  slug: string;
  kind: ComponentKind;
  name: string;
  description: string;
  owner_user_id: string;
  review_status: ComponentReviewStatus;
  source_kind: ComponentSourceKind;
  source_ref: string;
  endpoint: null;
  auth_strategy: null;
  data_classification: "public" | "internal" | "confidential" | "restricted";
  homepage_url: null;
}

/** Promote a discovery candidate into a DRAFT component. Never sets
 *  `review_status: "approved"` — that happens through the normal review
 *  path afterward, exactly like a first-party publish. */
export function promoteCandidate(input: PromoteCandidateInput): PromotedComponent {
  return {
    tenant_id: input.tenantId,
    slug: input.slug,
    kind: input.proposedKind,
    name: input.name,
    description: input.description,
    owner_user_id: input.ownerUserId,
    review_status: "draft",
    source_kind: "imported",
    source_ref: `discovery_candidate:${input.candidateId}:${input.sourceId}:${input.externalRef}`,
    endpoint: null,
    auth_strategy: null,
    data_classification: input.dataClassification,
    homepage_url: null,
  };
}

export interface PinImportedVersionInput {
  componentId: string;
  tenantId: string;
  /** MUST be an exact semver triplet resolved from the upstream source at
   *  sync time — never a tag, branch, or "latest". */
  upstreamVersion: string;
  /** MUST be a well-formed `sha256:<hex>` digest of the upstream artifact. */
  upstreamDigest: string;
  manifest: Record<string, unknown>;
  publishedBy: string;
}

export interface PinnedImportedVersion {
  tenant_id: string;
  component_id: string;
  version: string;
  manifest: Record<string, unknown>;
  blob_digest: string;
  published_by: string;
}

/** Reject anything that isn't an exact, immutable upstream reference. */
export function assertExactUpstreamPin(version: string, digest: string): void {
  if (KNOWN_MUTABLE_REFS.has(version.toLowerCase())) {
    throw new Error(
      `pinImportedVersion: "${version}" is a mutable reference (tag/branch), not an exact version — ` +
        `every imported version must pin an exact upstream semver + digest`,
    );
  }
  if (!EXACT_SEMVER_RE.test(version)) {
    throw new Error(`pinImportedVersion: "${version}" is not an exact semver triplet (x.y.z)`);
  }
  if (!DIGEST_RE.test(digest)) {
    throw new Error(`pinImportedVersion: "${digest}" is not a well-formed sha256:<hex> digest`);
  }
}

export function pinImportedVersion(input: PinImportedVersionInput): PinnedImportedVersion {
  assertExactUpstreamPin(input.upstreamVersion, input.upstreamDigest);
  return {
    tenant_id: input.tenantId,
    component_id: input.componentId,
    version: input.upstreamVersion,
    manifest: input.manifest,
    blob_digest: input.upstreamDigest,
    published_by: input.publishedBy,
  };
}
