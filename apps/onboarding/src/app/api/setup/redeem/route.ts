import { appRouter, createContext } from "@arm/trpc";

export const dynamic = "force-dynamic";

/**
 * REST wrapper around `onboarding.redeemSetupToken` (docs/guides/
 * 03-client-downloader.md §1/§5). `@arm/client-core`'s `resolveFromSetupToken`
 * (the A4 primary path — `arm setup --token <jwt>`) speaks plain JSON here,
 * not tRPC's wire protocol: `packages/client-core` must not depend on
 * `@arm/trpc` (boundaries guardrail — data-plane-importable packages stay
 * below the control-plane layer), so the wire contract is a small REST
 * facade instead. See `packages/client-core/src/setup-token.ts` for the
 * response schema this must match byte-for-byte.
 *
 * Always responds 200 — the logical outcome lives in the JSON body's
 * `status` field (ok/expired/already_used/invalid), matching how
 * `resolveFromSetupToken` parses the response.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ status: "invalid", message: "malformed request body" });
  }
  const token = typeof (body as { token?: unknown })?.token === "string" ? (body as { token: string }).token : "";
  if (!token) {
    return Response.json({ status: "invalid", message: "missing token" });
  }

  const caller = appRouter.createCaller(createContext({ claims: null }));
  const result = await caller.onboarding.redeemSetupToken({ token });
  return Response.json(result);
}
