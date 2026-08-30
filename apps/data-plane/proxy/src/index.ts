/**
 * ARM Closed-Proxy (spec §5.2, §9 1.2).
 *
 * Hono-based proxy for OpenAI/Anthropic wire protocols. Authenticates agents,
 * enforces per-agent quotas with priority-aware enforcement (tier ladder),
 * and emits metadata-only metering events. Prompt bodies and completions
 * never persist or leave the tenant VPC (Invariant §11.1).
 *
 * Stub mode (1.2 scaffold): returns simulated LLM responses. Real mode
 * delegates to upstream provider APIs when credentials are configured.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { TokenUsageEvent } from "@arm/proto";
import { config } from "@arm/config";

// ── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono();

app.use("*", cors());

// ── Types ──────────────────────────────────────────────────────────────────

type PriorityTier = "critical" | "standard" | "background";
type Provider = "anthropic" | "openai";

interface AgentContext {
  subAccountId: string;
  agentId: string;
  tenantId: string;
  priorityTier: PriorityTier;
  quota: { dailyCapUsd: number; usedTodayUsd: number };
  allowedModels: string[];
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
}

interface MeteringEvent {
  subAccountId: string;
  agentId: string;
  tenantId: string;
  priorityTier: PriorityTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  source: TokenUsageEvent["source"];
  ts: string;
}


// ── Delegate Key Rotation (spec §7.2, §9 1.2) ──────────────────────────────

interface DelegateKey { keyRef: string; rotatedAt: string; expiresAt: string; }

const delegateKeys = new Map<string, DelegateKey>();

export function rotateDelegateKey(tenantId: string): DelegateKey {
  const keyRef = `dk_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const key: DelegateKey = {
    keyRef, rotatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  delegateKeys.set(tenantId, key);
  return key;
}

export function validateDelegateKey(tenantId: string, keyRef: string): boolean {
  const stored = delegateKeys.get(tenantId);
  if (!stored) return true;
  return new Date(stored.expiresAt) > new Date() && stored.keyRef === keyRef;
}

// ── In-Memory Quota Store (real impl uses Redis/Postgres) ─────────────────

const quotaStore = new Map<string, { dailyCapUsd: number; usedTodayUsd: number }>();

/**
 * Resolves agent context from request headers.
 * Production: verifies API key against tenant vault.
 * Stub: returns a demo agent context.
 */
function resolveAgent(req: Request): AgentContext {
  const authHeader = req.headers.get("Authorization") ?? "";
  const subAccountId = req.headers.get("X-ARM-SubAccountId") ?? "sa_demo";
  const agentId = req.headers.get("X-ARM-AgentId") ?? "agt_demo";
  const tenantId = req.headers.get("X-ARM-TenantId") ?? "tn_demo";

  // Stub: resolve quota from local store (or default)
  const quotaKey = subAccountId;
  if (!quotaStore.has(quotaKey)) {
    quotaStore.set(quotaKey, { dailyCapUsd: 50, usedTodayUsd: 0 });
  }
  const quota = quotaStore.get(quotaKey)!;

  return {
    subAccountId,
    agentId,
    tenantId,
    priorityTier: "standard",
    quota,
    allowedModels: ["claude-sonnet-4-20250514", "gpt-4o", "glm-5.2"],
    classificationClearance: "internal",
  };
}

// ── Priority-Aware Quota Enforcement (spec §5.2, §6.6) ────────────────────

/**
 * Checks if a request is within the agent's quota. Applies tier enforcement:
 *   - critical: always allowed (draws from reserve)
 *   - standard: throttled when daily cap exhausted (429 + Retry-After)
 *   - background: downgraded to open models first, then throttled
 */
function checkQuota(agent: AgentContext, estimatedCostUsd: number): { allowed: boolean; reason?: string; retryAfter?: number } {
  const { priorityTier, quota } = agent;

  // Critical tier: always passes (reserve draw)
  if (priorityTier === "critical") {
    return { allowed: true };
  }

  // Check remaining budget
  const remaining = quota.dailyCapUsd - quota.usedTodayUsd;

  if (priorityTier === "background") {
    // Background: downgrade to open models first
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `background_tier_quota_exhausted: used $${quota.usedTodayUsd} of $${quota.dailyCapUsd}`,
        retryAfter: 3600, // 1 hour
      };
    }
    if (estimatedCostUsd > remaining * 0.5) {
      return {
        allowed: false,
        reason: "background_tier_downgrade_to_open_models",
        retryAfter: 60,
      };
    }
  }

  // Standard tier
  if (priorityTier === "standard" && remaining <= 0) {
    return {
      allowed: false,
      reason: `standard_tier_quota_exhausted: used $${quota.usedTodayUsd} of $${quota.dailyCapUsd}`,
      retryAfter: 300,
    };
  }

  // Within quota
  return { allowed: true };
}

// ── Model Selection Enforcement (spec §6.5 DLP Gate) ──────────────────────

const CLOSED_MODELS = ["claude-sonnet-4-20250514", "gpt-4o", "gpt-4o-mini", "o3-mini"];

function checkModelAccess(agent: AgentContext, model: string): { allowed: boolean; reason?: string } {
  // Classification DLP gate: confidential/restricted → self-hosted only
  if ((agent.classificationClearance === "confidential" || agent.classificationClearance === "restricted") &&
      CLOSED_MODELS.includes(model)) {
    return {
      allowed: false,
      reason: `classification_gate: clearance ${agent.classificationClearance} restricted from closed model ${model}. Use self-hosted models.`,
    };
  }

  if (!agent.allowedModels.includes(model) && !agent.allowedModels.includes("*")) {
    return { allowed: false, reason: `model_not_allowed: ${model}` };
  }

  return { allowed: true };
}

// ── Simulated LLM Response (stub) ─────────────────────────────────────────

function simulateResponse(model: string, provider: Provider, inputTokens: number): {
  outputTokens: number;
  costUsd: number;
  content: string;
} {
  const outputTokens = Math.floor(inputTokens * 0.6 + Math.random() * 200);
  const pricePerMIn = provider === "openai" ? 2.5 : 3.0;
  const pricePerMOut = provider === "openai" ? 10 : 15;
  const costUsd = (inputTokens / 1_000_000) * pricePerMIn + (outputTokens / 1_000_000) * pricePerMOut;
  return {
    outputTokens,
    costUsd: Math.round(costUsd * 1000) / 1000,
    content: `[ARM proxy stub] Simulated response from ${model}. ${outputTokens} tokens generated.`,
  };
}

// ── Real upstream (opt-in — unset by default, stub above is unchanged) ────
//
// "Real mode: delegates to upstream provider APIs when credentials are
// configured" (this file's own header comment) — this is that mode's first
// concrete implementation, scoped to an OpenAI-chat-completions-compatible
// upstream (which covers a local Ollama instance, the sandbox demo
// environment's own backend per docker-compose.enterprise.yml). The client
// still requests an ARM-standard model name (so checkModelAccess's gate is
// unchanged); the proxy decides which real backend model actually answers
// it — the same abstraction a production deployment would make.
const REAL_UPSTREAM_URL = process.env["ARM_PROXY_UPSTREAM_URL"];
const REAL_UPSTREAM_MODEL = process.env["ARM_PROXY_UPSTREAM_MODEL"] ?? "minicpm5-1b";

async function generateResponse(
  model: string,
  provider: Provider,
  messages: { role: string; content: string }[],
  inputTokens: number,
): Promise<{ outputTokens: number; costUsd: number; content: string }> {
  if (REAL_UPSTREAM_URL) {
    try {
      const res = await fetch(`${REAL_UPSTREAM_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: REAL_UPSTREAM_MODEL, messages }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { completion_tokens?: number };
        };
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          const outputTokens = json.usage?.completion_tokens ?? Math.ceil(text.length / 4);
          const pricePerMIn = provider === "openai" ? 2.5 : 3.0;
          const pricePerMOut = provider === "openai" ? 10 : 15;
          const costUsd =
            Math.round(((inputTokens / 1_000_000) * pricePerMIn + (outputTokens / 1_000_000) * pricePerMOut) * 1000) /
            1000;
          return { outputTokens, costUsd, content: text };
        }
      }
    } catch {
      // Real upstream unreachable — degrade to the stub rather than fail
      // the request; never blocks the install flow on a dev backend hiccup.
    }
  }
  return simulateResponse(model, provider, inputTokens);
}

// ── Metering Event Emission ───────────────────────────────────────────────

const meteringBuffer: MeteringEvent[] = [];

function emitMeteringEvent(event: MeteringEvent): void {
  meteringBuffer.push(event);
  // Update in-memory quota (TODO: persist to ClickHouse via meter-agent)
  const key = event.subAccountId;
  const quota = quotaStore.get(key);
  if (quota) {
    quota.usedTodayUsd += event.costUsd;
  }
  // In production: push to local event buffer → meter-agent → control plane
  console.debug(`[meter] ${event.agentId} | ${event.model} | $${event.costUsd.toFixed(4)} | ${event.inputTokens}+${event.outputTokens}tk`);
}

// ── Routes ─────────────────────────────────────────────────────────────────

/** Health check (no auth). */
app.get("/health", (c) => c.json({ status: "ok", service: "closed-proxy", version: "0.0.0" }));

/** Get metering buffer for debugging (stub — production: internal-only). */
app.get("/metering", (c) => c.json({ events: meteringBuffer.length, buffer: meteringBuffer.slice(-10) }));

/**
 * Unified LLM proxy endpoint. Routes to Anthropic or OpenAI based on model.
 *
 * POST /v1/proxy
 * Body: { model, messages, max_tokens?, stream? }
 * Headers: Authorization, X-ARM-SubAccountId, X-ARM-AgentId, X-ARM-TenantId
 */
app.post("/v1/proxy", async (c) => {
  const agent = resolveAgent(c.req.raw);

  const body = await c.req.json().catch(() => ({}));
  const { model, messages, max_tokens, stream } = z.object({
    model: z.string().default("claude-sonnet-4-20250514"),
    messages: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
    max_tokens: z.number().optional(),
    stream: z.boolean().optional(),
  }).parse(body);

  // Compute prompt tokens (approximate: 4 char/token for English)
  const promptText = messages.map((m) => m.content).join("\n");
  const inputTokens = Math.ceil(promptText.length / 4);

  // ── Gate 1: Model access (DLP classification gate) ──
  const modelAccess = checkModelAccess(agent, model);
  if (!modelAccess.allowed) {
    return c.json({
      error: { type: "model_access_denied", message: modelAccess.reason },
    }, 403);
  }

  // ── Gate 2: Quota (priority-aware) ──
  const estimatedCost = (inputTokens / 1_000_000) * 3 + 0.001; // rough estimate
  const quotaResult = checkQuota(agent, estimatedCost);
  if (!quotaResult.allowed) {
    const status = quotaResult.reason?.includes("background") ? 429 : 402;
    return c.json({
      error: { type: "quota_exceeded", message: quotaResult.reason },
      retry_after: quotaResult.retryAfter,
    }, status);
  }

  // ── Generate response ──
  const provider: Provider = CLOSED_MODELS.includes(model) ? "openai" : "anthropic";
  const response = await generateResponse(model, provider, messages, inputTokens);

  // ── Emit metering event (metadata-only — no content) ──
  emitMeteringEvent({
    subAccountId: agent.subAccountId,
    agentId: agent.agentId,
    tenantId: agent.tenantId,
    priorityTier: agent.priorityTier,
    model,
    inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    source: "proxy",
    ts: new Date().toISOString(),
  });

  if (stream) {
    // Simulated SSE stream (stub)
    const encoder = new TextEncoder();
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "content_block_delta",
          delta: { text: response.content },
        })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "message_stop",
          usage: { input_tokens: inputTokens, output_tokens: response.outputTokens },
        })}\n\n`));
        controller.close();
      },
    });
    return c.body(streamBody, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return c.json({
    id: `msg_${Date.now()}`,
    model,
    content: [{ type: "text", text: response.content }],
    usage: { input_tokens: inputTokens, output_tokens: response.outputTokens },
    stop_reason: "end_turn",
  });
});

export default app;
export { checkQuota, checkModelAccess, resolveAgent, type AgentContext, type MeteringEvent };

// ── Server start (sandbox entry point — zero deps, uses node:http) ──
import { createServer } from "node:http";
const PORT = parseInt(process.env.PROXY_PORT ?? "8787");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const request = new Request(url, { method: req.method ?? "GET", headers });
    // Read body if present
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      if (body) {
        const req2 = new Request(url, { method: req.method ?? "GET", headers, body });
        const resp = await app.fetch(req2);
        res.writeHead(resp.status, Object.fromEntries(resp.headers));
        const respBody = await resp.text();
        res.end(respBody);
        return;
      }
    }
    const resp = await app.fetch(request);
    res.writeHead(resp.status, Object.fromEntries(resp.headers));
    const respBody = await resp.text();
    res.end(respBody);
  } catch (err) {
    console.error("[proxy-error]", err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "proxy_internal_error" }));
  }
}).listen(PORT, () => console.log(`[closed-proxy] http://localhost:${PORT}`));
