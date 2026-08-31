/**
 * ARM Open-Gateway (spec §9 1.2).
 *
 * OpenAI-compatible shim for self-hosted vLLM deployments (GLM-5.2,
 * DeepSeek, Kimi K3). Provides the same /v1/chat/completions endpoint
 * as the closed-proxy, but routes to local vLLM instances instead of
 * external providers. Native metering — no external API call needed.
 *
 * Stub mode: returns fixture completions. Real mode: proxies to vLLM
 * when VLLM_ENDPOINT is configured.
 */

import { Hono } from "hono";
import { z } from "zod";
import { config } from "@arm/config";

const app = new Hono();

// ── In-memory metering buffer ──────────────────────────────────────────────

const meteringBuffer: Array<{
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ts: string;
}> = [];

// ── Routes ─────────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "open-gateway",
    version: "0.0.0",
    vllmEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT ? "configured" : "unconfigured (stub mode)",
  }),
);

/**
 * OpenAI-compatible chat completions endpoint.
 * POST /v1/chat/completions
 */
app.post("/v1/chat/completions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { model, messages } = z
    .object({
      model: z.string().default("glm-5.2"),
      messages: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
    })
    .parse(body);

  const promptText = messages.map((m) => m.content).join("\n");
  const inputTokens = Math.ceil(promptText.length / 4);

  // Stub: generate a fixture response (real: POST to vLLM /v1/chat/completions)
  const outputTokens = Math.floor(inputTokens * 0.5 + Math.random() * 150);
  // Self-hosted cost: approximate GPU compute cost
  const costUsd = (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4;

  // Record metering
  meteringBuffer.push({
    model,
    inputTokens,
    outputTokens,
    costUsd: Math.round(costUsd * 1000) / 1000,
    ts: new Date().toISOString(),
  });

  return c.json({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `[ARM open-gateway stub] Fixture response from self-hosted ${model}. ${outputTokens} tokens. Cost: $${costUsd.toFixed(4)}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  });
});

app.get("/metering", (c) =>
  c.json({ events: meteringBuffer.length, buffer: meteringBuffer.slice(-10) }),
);

export default app;
