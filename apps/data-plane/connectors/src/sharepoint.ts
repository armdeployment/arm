/**
 * ARM SharePoint / OneDrive Connector — mint+sync hybrid (spec §6.2, §9 1.4).
 *
 * Mint strategy: issues scoped Microsoft Graph API tokens via ARM-as-OIDC-issuer.
 * Sync strategy: periodically syncs SharePoint site/doc permissions to ARM grants.
 *
 * Spec §12: drift detection job from day one in 1.4.
 *
 * Stub mode: returns fixture token + permission set.
 */

export interface SharePointScopeRequest {
  agentId: string;
  tenantId: string;
  siteUrl: string;
  driveId?: string; // OneDrive
  scopes: ("sites.read" | "files.read" | "files.readwrite" | "sites.read.all")[];
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
  ttlMinutes?: number;
}

export interface SharePointToken {
  accessToken: string;
  expiresAt: string;
  siteUrl: string;
  scopes: string[];
}

export interface PermissionSyncResult {
  siteUrl: string;
  syncedGrants: number;
  addedGrants: number;
  removedGrants: number; // stale grants that were revoked
  driftDetected: boolean;
  driftDetails?: string[];
  syncedAt: string;
}

/**
 * Mints a scoped Microsoft Graph API token via ARM-OIDC-issuer.
 * Invariant §11.4: short-lived (≤60 min).
 */
export async function mintSharePointToken(req: SharePointScopeRequest): Promise<SharePointToken> {
  const ttlMinutes = Math.min(req.ttlMinutes ?? 15, 60);
  return {
    accessToken: `EwC_MOCK_${req.agentId}_${Date.now()}`,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    siteUrl: req.siteUrl,
    scopes: req.scopes,
  };
}

/**
 * Syncs SharePoint site/doc permissions to ARM grants.
 * Spec §12: detects drift — permissions in SharePoint that are not in ARM
 * (or vice versa) flag as drift.
 *
 * Stub: returns a sync result with 0 drift (clean state).
 */
export async function syncSharePointPermissions(siteUrl: string): Promise<PermissionSyncResult> {
  // TODO(1.4): Real Graph API call: GET /sites/{siteId}/permissions
  // Compare against ARM grants for this resource.
  // If any ARM grant is stale (not in SharePoint), auto-revoke and flag.
  return {
    siteUrl,
    syncedGrants: 12,
    addedGrants: 0,
    removedGrants: 0,
    driftDetected: false,
    syncedAt: new Date().toISOString(),
  };
}
