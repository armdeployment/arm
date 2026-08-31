/**
 * The A4 token path — docs/guides/03-client-downloader.md §1, §5.
 *
 * "Custom downloader" is one signed generic client + a per-user signed setup
 * token (never a per-user compiled binary). The token travels either as a
 * raw JWT (inside a downloaded `.armsetup` companion file) or as a 6-char
 * activation code. `resolveFromSetupToken` redeems either form against the
 * control plane, verifies the returned manifest's content hash (existing
 * `verifyManifestIntegrity`), and returns the same `SetupArgs` shape the
 * `--role`/flags path builds — so `runSetup` (setup.ts) needs no changes
 * below that seam; it just finds `args.manifest` already populated and skips
 * the `fetchManifest` round-trip.
 *
 * Wire contract (REST, not tRPC — `packages/client-core` must not depend on
 * `@arm/trpc`; see the `boundaries` guardrail): the control plane exposes
 * `POST {controlPlaneUrl}/api/setup/redeem` (raw JWT) and
 * `POST {controlPlaneUrl}/api/setup/resolve-code` (6-char code), both
 * returning `setupRedemptionResponseSchema` below. `apps/onboarding` hosts
 * these as thin wrappers around `onboarding-router.ts`'s
 * `redeemSetupToken`/`resolveActivationCode` tRPC procedures.
 */

import { z } from "zod";
import { clientPackageManifestSchema, verifyManifestIntegrity } from "./manifest.js";
import { ArmClientError } from "./errors.js";
import type { SetupArgs } from "./setup.js";

const connectionsManifestEntryWireSchema = z.object({
  componentId: z.string(),
  componentName: z.string(),
  authMethod: z.enum(["oauth", "pat", "service_account", "none"]),
  guideId: z.string(),
  requiredScopes: z.array(z.string()),
});

/** Wire contract for `/api/setup/redeem` and `/api/setup/resolve-code`. */
export const setupRedemptionResponseSchema = z.object({
  status: z.enum(["ok", "expired", "already_used", "invalid"]),
  message: z.string().default(""),
  manifest: clientPackageManifestSchema.optional(),
  connections: z.array(connectionsManifestEntryWireSchema).optional(),
  sub_account_id: z.string().optional(),
  tenant_id: z.string().optional(),
  proxy_url: z.string().optional(),
  data_plane_url: z.string().optional(),
  catalog_token: z.string().optional(),
  agent_token: z.string().optional(),
  pending_approval: z.boolean().optional(),
});
export type SetupRedemptionResponse = z.infer<typeof setupRedemptionResponseSchema>;

/** A raw setup JWT has two dots; a 6-char activation code never does. */
function looksLikeActivationCode(token: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(token.trim());
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function redemptionError(
  status: SetupRedemptionResponse["status"],
  message: string,
): ArmClientError {
  switch (status) {
    case "expired":
      return new ArmClientError("TOKEN_EXPIRED", message || "this setup link has expired");
    case "already_used":
      return new ArmClientError(
        "TOKEN_ALREADY_USED",
        message || "this setup link was already used — ask IT for a new one",
      );
    default:
      return new ArmClientError("TOKEN_EXPIRED", message || "this setup link is invalid");
  }
}

/**
 * Redeem a setup token (raw JWT) or resolve+redeem a 6-char activation code,
 * verify the returned manifest's integrity, and produce a `SetupArgs` ready
 * for `runSetup`. Throws `ArmClientError` with a stable code on every
 * expected failure (expired/used token, unreachable control plane, tampered
 * manifest).
 */
export async function resolveFromSetupToken(args: {
  token: string;
  controlPlaneUrl: string;
}): Promise<SetupArgs> {
  const base = normalizeBaseUrl(args.controlPlaneUrl);
  const isCode = looksLikeActivationCode(args.token);
  const endpoint = isCode ? `${base}/api/setup/resolve-code` : `${base}/api/setup/redeem`;
  const body = isCode ? { code: args.token.trim().toUpperCase() } : { token: args.token.trim() };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `could not reach the control plane to redeem the setup token: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("setup redemption response is not JSON");
  }

  const parsed = setupRedemptionResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `invalid setup redemption response — ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const data = parsed.data;

  if (data.status !== "ok" || data.manifest === undefined) {
    throw redemptionError(data.status, data.message);
  }

  if (!verifyManifestIntegrity(data.manifest.version)) {
    throw new ArmClientError(
      "MANIFEST_TAMPERED",
      `package manifest integrity check FAILED for "${data.manifest.package.role_key}"@${data.manifest.version.version} — refusing to proceed from a tampered manifest`,
    );
  }

  return {
    controlPlaneUrl: args.controlPlaneUrl,
    token: data.catalog_token ?? args.token,
    roleKey: data.manifest.package.role_key,
    armProxyUrl: data.proxy_url ?? args.controlPlaneUrl,
    subAccountId: data.sub_account_id ?? "pending-assignment",
    tenantId: data.tenant_id ?? data.manifest.package.tenant_id,
    manifest: data.manifest,
    pendingApproval: data.pending_approval ?? false,
    ...(data.data_plane_url !== undefined ? { dataPlaneUrl: data.data_plane_url } : {}),
    ...(data.agent_token !== undefined ? { agentToken: data.agent_token } : {}),
  };
}
