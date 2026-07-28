/**
 * ARM GCS Connector — mint strategy (spec §6.2, §9 1.3).
 *
 * Issues scoped, short-lived Google Cloud Storage credentials via Workload
 * Identity Federation. ARM-issued OIDC tokens are exchanged for GCP access
 * tokens scoped to specific buckets/prefixes.
 *
 * Stub mode: returns fixture signed URLs. Real mode: exchanges OIDC token
 * for GCP access token via STS, then generates signed URLs.
 */

export interface GCSScopeRequest {
  agentId: string;
  tenantId: string;
  bucket: string;
  prefix?: string;
  actions: ("read" | "write" | "list")[];
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
  ttlMinutes?: number; // default 15 (Invariant §11.4)
}

export interface GCSCredential {
  accessToken: string;
  signedUrl?: string;
  expiresAt: string;
  bucket: string;
  prefix: string;
}

/**
 * Mints a scoped GCS credential via Workload Identity Federation.
 *
 * Production flow:
 *   1. ARM issues an OIDC token for the agent
 *   2. Exchange with GCP STS for an access token
 *   3. If signed URLs preferred: generate a V4 signed URL with the access token
 *
 * Invariant §11.4: short-lived credentials (≤60 min).
 */
export async function mintGCSCredential(req: GCSScopeRequest): Promise<GCSCredential> {
  const ttlMinutes = Math.min(req.ttlMinutes ?? 15, 60);
  const prefix = req.prefix ?? `${req.tenantId}/${req.agentId}/`;

  return {
    accessToken: `ya29_MOCK_${req.agentId}_${Date.now()}`,
    signedUrl: `https://storage.googleapis.com/${req.bucket}/${prefix}?X-Goog-Signature=MOCK_${Date.now()}`,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    bucket: req.bucket,
    prefix,
  };
}
