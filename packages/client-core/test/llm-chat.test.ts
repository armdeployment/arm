import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { sendChatMessage, INSTALL_ASSISTANT_SYSTEM_PROMPT } from "../src/llm-chat.js";
import { ArmClientError } from "../src/errors.js";

describe("sendChatMessage", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
  });

  async function startMockProxy(
    handler: (
      body: unknown,
      headers: Record<string, string | string[] | undefined>,
    ) => { status: number; body: unknown },
  ): Promise<string> {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        const result = handler(body, req.headers);
        res.writeHead(result.status, { "content-type": "application/json" });
        res.end(JSON.stringify(result.body));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  it("posts to /v1/proxy with Bearer auth + tenant headers, prepends the system prompt, and returns the reply text", async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string | string[] | undefined> = {};
    const armProxyUrl = await startMockProxy((body, headers) => {
      capturedBody = body;
      capturedHeaders = headers;
      return {
        status: 200,
        body: {
          id: "msg_1",
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "What's your role?" }],
          usage: {},
          stop_reason: "end_turn",
        },
      };
    });

    const reply = await sendChatMessage({
      armProxyUrl,
      agentToken: "arm_mtr_test-token",
      subAccountId: "sa_123",
      tenantId: "tn_123",
      messages: [{ role: "user", content: "I lead a manufacturing plant" }],
    });

    expect(reply).toBe("What's your role?");
    expect(capturedHeaders["authorization"]).toBe("Bearer arm_mtr_test-token");
    expect(capturedHeaders["x-arm-subaccountid"]).toBe("sa_123");
    expect(capturedHeaders["x-arm-tenantid"]).toBe("tn_123");
    const sentMessages = (capturedBody as { messages: { role: string; content: string }[] })
      .messages;
    expect(sentMessages[0]).toEqual({ role: "system", content: INSTALL_ASSISTANT_SYSTEM_PROMPT });
    expect(sentMessages[1]).toEqual({ role: "user", content: "I lead a manufacturing plant" });
  });

  it("throws ArmClientError('PROXY_UNREACHABLE') on a non-2xx response", async () => {
    const armProxyUrl = await startMockProxy(() => ({
      status: 403,
      body: { error: { type: "model_access_denied" } },
    }));
    await expect(
      sendChatMessage({
        armProxyUrl,
        agentToken: "t",
        subAccountId: "sa",
        tenantId: "tn",
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "PROXY_UNREACHABLE" } satisfies Partial<ArmClientError>);
  });

  it("throws ArmClientError when the response has no text content block", async () => {
    const armProxyUrl = await startMockProxy(() => ({ status: 200, body: { content: [] } }));
    await expect(
      sendChatMessage({
        armProxyUrl,
        agentToken: "t",
        subAccountId: "sa",
        tenantId: "tn",
        messages: [],
      }),
    ).rejects.toThrow(/no text content/);
  });

  it("throws ArmClientError when the proxy is unreachable", async () => {
    await expect(
      sendChatMessage({
        armProxyUrl: "http://127.0.0.1:1", // reserved port, nothing listens
        agentToken: "t",
        subAccountId: "sa",
        tenantId: "tn",
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "PROXY_UNREACHABLE" });
  });
});
