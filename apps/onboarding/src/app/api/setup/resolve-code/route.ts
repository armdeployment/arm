import { appRouter, createContext } from "@arm/trpc";

export const dynamic = "force-dynamic";

/**
 * REST wrapper around `onboarding.resolveActivationCode` — the 6-char-code
 * counterpart to `/api/setup/redeem` (see that route's doc comment for the
 * wire-contract rationale).
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ status: "invalid", message: "malformed request body" });
  }
  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  if (code.length !== 6) {
    return Response.json({ status: "invalid", message: "activation code must be 6 characters" });
  }

  const caller = appRouter.createCaller(createContext({ claims: null }));
  const result = await caller.onboarding.resolveActivationCode({ code });
  return Response.json(result);
}
