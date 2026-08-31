/**
 * LLM-backed interactive chat for the installation wizard — "describe what
 * you do" (docs/solutions/2026-08-30-gui-installer-and-bundled-runtimes.md
 * and its follow-up). An employee can talk through their job instead of
 * writing a single paragraph, and get a real reply, not a canned one.
 *
 * Routes through the TENANT's own already-authorized data-plane proxy
 * (armProxyUrl + agentToken from the `arm setup` redemption that just
 * completed — the exact credential every other agent call this install
 * will make already uses) via the proxy's real `/v1/proxy` contract
 * (apps/data-plane/proxy). Never a third-party LLM API directly, never
 * ARM's own control plane — the proxy is tenant-VPC infrastructure, so this
 * keeps prompt content inside the tenant boundary (spec §11.1 Invariant 1)
 * exactly like every other agent call this employee will ever make.
 *
 * The conversation itself is NOT the auditable signal. Once the user is
 * done, the caller feeds the transcript through the same deterministic
 * `classifyPainPoints` (pain-points.ts) a plain textarea would have used —
 * "why did I get tagged X" still always has a one-line keyword answer,
 * regardless of whether the text came from one paragraph or a ten-turn
 * conversation. This module never classifies anything itself.
 */

import { ArmClientError } from "./errors.js";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatTurnArgs {
  armProxyUrl: string;
  agentToken: string;
  subAccountId: string;
  tenantId: string;
  /** Full conversation so far, ending with the newest user message. */
  messages: ChatMessage[];
  /** ARM-standard model name — the proxy (not the client) decides which
   *  real backend answers it (checkModelAccess's allowlist, apps/data-plane/
   *  proxy/src/index.ts). Defaults to the proxy's own default model. */
  model?: string;
}

export const INSTALL_ASSISTANT_SYSTEM_PROMPT =
  "You are ARM's installation assistant, helping a new employee finish setting up their AI agent. " +
  "Ask short, specific, friendly questions (one at a time) to learn: their role, the tools/software " +
  "they use day to day, and their single biggest recurring pain point at work. Keep every reply to " +
  "2-3 sentences. After 2-4 exchanges, once you have a clear picture, summarize what you learned in " +
  "one short paragraph and say you have enough to help fine-tune their setup.";

/** Send one chat turn to the tenant's proxy and return the assistant's
 *  reply text. Throws ArmClientError("PROXY_UNREACHABLE", ...) on any
 *  network failure, non-2xx response, or a response with no text content —
 *  callers should surface this as "the assistant is unavailable right now",
 *  never silently fabricate a reply. */
export async function sendChatMessage(args: ChatTurnArgs): Promise<string> {
  const endpoint = `${args.armProxyUrl.replace(/\/+$/, "")}/v1/proxy`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${args.agentToken}`,
        "x-arm-subaccountid": args.subAccountId,
        "x-arm-tenantid": args.tenantId,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [{ role: "system", content: INSTALL_ASSISTANT_SYSTEM_PROMPT }, ...args.messages],
      }),
    });
  } catch (err) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `could not reach the ARM proxy for the install assistant: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `install assistant request failed (HTTP ${res.status})`,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ArmClientError("PROXY_UNREACHABLE", "install assistant response was not JSON");
  }

  const content = (json as { content?: { type?: string; text?: string }[] }).content;
  const text = content?.find((block) => block.type === "text")?.text;
  if (!text) {
    throw new ArmClientError("PROXY_UNREACHABLE", "install assistant response had no text content");
  }
  return text;
}
