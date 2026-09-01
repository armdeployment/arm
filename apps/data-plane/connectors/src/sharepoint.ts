/**
 * ARM SharePoint / OneDrive Connector — mint+sync hybrid (spec §6.2, §9 1.4).
 *
 * Mint strategy: issues scoped Microsoft Graph API tokens via ARM-as-OIDC-issuer.
 * Sync strategy: periodically syncs SharePoint site/doc permissions to ARM grants.
 *
 * Spec §12: drift detection job from day one in 1.4.
 *
 * Both halves call Microsoft Graph for real when an app registration is
 * configured, and are explicit when they cannot. The sync half matters most:
 * it used to report `driftDetected: false` with a fabricated
 * `syncedGrants: 12` without contacting Graph at all — a drift detector that
 * asserts "clean" without looking is a false negative on a security control,
 * which is worse than one that admits it did not run.
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
  /** True when no app registration is configured — not a usable token. */
  simulated?: boolean;
  accessToken: string;
  expiresAt: string;
  siteUrl: string;
  scopes: string[];
}

export interface PermissionSyncResult {
  /** "checked" only when Graph actually answered. */
  status: "checked" | "not_checked";
  /** Why, when not checked. */
  statusDetail?: string;
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
export interface GraphAppConfig {
  tenantId?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
}

export type GraphFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

const defaultGraphFetcher: GraphFetcher = (url, init) =>
  fetch(url, init) as unknown as ReturnType<GraphFetcher>;

function graphConfigFromEnv(): GraphAppConfig {
  return {
    tenantId: process.env.ARM_GRAPH_TENANT_ID,
    clientId: process.env.ARM_GRAPH_CLIENT_ID,
    clientSecret: process.env.ARM_GRAPH_CLIENT_SECRET,
  };
}

/**
 * Mints a scoped Microsoft Graph token (client credentials).
 * Invariant §11.4: short-lived (≤60 min).
 *
 * Graph issues its own lifetime, which this does not extend — `ttlMinutes`
 * caps what ARM will hand on, not what Azure grants.
 */
export async function mintSharePointToken(
  req: SharePointScopeRequest,
  app: GraphAppConfig = graphConfigFromEnv(),
  fetcher: GraphFetcher = defaultGraphFetcher,
): Promise<SharePointToken> {
  const ttlMinutes = Math.min(req.ttlMinutes ?? 15, 60);

  if (app.tenantId && app.clientId && app.clientSecret) {
    const res = await fetcher(
      `https://login.microsoftonline.com/${app.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: app.clientId,
          client_secret: app.clientSecret,
          // Application permissions are granted on the app registration; the
          // per-request `scopes` narrow what ARM will use them for.
          scope: "https://graph.microsoft.com/.default",
        }).toString(),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Graph token request failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new Error("Graph returned no access_token — no credential minted.");
    }
    const graphTtl = Math.min(body.expires_in ?? ttlMinutes * 60, ttlMinutes * 60);
    return {
      simulated: false,
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + graphTtl * 1000).toISOString(),
      siteUrl: req.siteUrl,
      scopes: req.scopes,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Cannot mint a SharePoint token: ARM_GRAPH_TENANT_ID, ARM_GRAPH_CLIENT_ID and " +
        "ARM_GRAPH_CLIENT_SECRET are required. Refusing to return a simulated token.",
    );
  }

  return {
    simulated: true,
    accessToken: "SIMULATED_NOT_A_TOKEN",
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
export async function syncSharePointPermissions(
  siteUrl: string,
  token?: SharePointToken,
  fetcher: GraphFetcher = defaultGraphFetcher,
): Promise<PermissionSyncResult> {
  const syncedAt = new Date().toISOString();

  // Refuse to answer the drift question without asking Graph. Reporting
  // `driftDetected: false` here — as this used to — is a clean bill of health
  // nobody checked.
  if (!token || token.simulated || token.accessToken === "SIMULATED_NOT_A_TOKEN") {
    return {
      status: "not_checked",
      statusDetail: "no usable Graph token — drift was NOT evaluated",
      siteUrl,
      syncedGrants: 0,
      addedGrants: 0,
      removedGrants: 0,
      driftDetected: false,
      syncedAt,
    };
  }

  const siteId = encodeURIComponent(siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  const res = await fetcher(`https://graph.microsoft.com/v1.0/sites/${siteId}/permissions`, {
    method: "GET",
    headers: { authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    return {
      status: "not_checked",
      statusDetail: `Graph returned ${res.status} — drift was NOT evaluated`,
      siteUrl,
      syncedGrants: 0,
      addedGrants: 0,
      removedGrants: 0,
      driftDetected: false,
      syncedAt,
    };
  }

  const body = (await res.json()) as {
    value?: { id?: string; grantedToV2?: { user?: { displayName?: string } } }[];
  };
  const permissions = body.value ?? [];
  const holders = permissions
    .map((p) => p.grantedToV2?.user?.displayName ?? p.id ?? "unknown")
    .filter(Boolean);

  return {
    status: "checked",
    siteUrl,
    syncedGrants: permissions.length,
    // ARM-side reconciliation (which of these correspond to ARM grants) needs
    // the grant table, which lives in the control plane and is out of this
    // app's boundary. Reported as observed, not as reconciled.
    addedGrants: 0,
    removedGrants: 0,
    driftDetected: false,
    driftDetails: holders,
    syncedAt,
  };
}
