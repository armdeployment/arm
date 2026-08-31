/**
 * The installation wizard's local server (installation wizard, "no
 * terminal" requirement, docs/solutions/2026-08-25-gtm-market-tiers-and-
 * wizard-plan.md). `arm setup` with no flags starts this instead of
 * prompting on stdin: a local HTTP server bound to 127.0.0.1 serving
 * gui-wizard-html.ts's page, opened automatically in the user's default
 * browser (cli-entry.ts). The user never sees a terminal — every action is
 * a click, a paste, or a native OS folder-picker dialog.
 *
 * This is the SAME engine `arm setup`'s CLI flags path always used
 * (`runSetup`, `resolveFromSetupToken`, the wizard-step scan modules) —
 * "one engine, every shape" (roadmap §5) was written anticipating exactly
 * this: a GUI installer wrapping the same client-core, not a second
 * implementation to keep in sync.
 *
 * Binds to 127.0.0.1 only (never 0.0.0.0) — this server must not be
 * reachable from the network, only from the browser it opens on the same
 * machine.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform as osPlatform } from "node:os";
import { runSetup, type SetupArgs, type SetupResult } from "./setup.js";
import { resolveFromSetupToken } from "./setup-token.js";
import { renderGuideSteps } from "./connections.js";
import { scanWorkFolders, type FolderScanResult } from "./folder-scan.js";
import { scanInstalledTools, type DetectedTool } from "./plugin-scan.js";
import { classifyPainPoints, type PainPointTag } from "./pain-points.js";
import { sendChatMessage, type ChatMessage } from "./llm-chat.js";
import { ArmClientError } from "./errors.js";
import { WIZARD_HTML } from "./gui-wizard-html.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_ARM_PROXY_URL = "http://localhost:8787";

/** Injectable seams — every route handler's real work goes through these,
 *  so tests exercise real HTTP without touching the network/filesystem/OS. */
export interface GuiServerDeps {
  resolveFn?: typeof resolveFromSetupToken;
  runSetupFn?: typeof runSetup;
  scanWorkFoldersFn?: typeof scanWorkFolders;
  scanInstalledToolsFn?: typeof scanInstalledTools;
  classifyPainPointsFn?: typeof classifyPainPoints;
  pickFolderFn?: () => Promise<string | null>;
  sendChatMessageFn?: typeof sendChatMessage;
}

export interface GuiServerOptions extends GuiServerDeps {
  armProxyUrl?: string;
  dataPlaneUrl?: string;
  agentHome?: string;
  agentToken?: string;
  /** 0 = OS-assigned ephemeral port (the default — avoids collisions). */
  port?: number;
}

export interface GuiServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/** Native OS folder picker — no terminal path-typing required. Returns
 *  null on cancel or on a platform/tool that isn't available (the UI falls
 *  back to a plain text field, still no terminal involved). */
async function defaultPickFolder(): Promise<string | null> {
  const plat = osPlatform();
  try {
    if (plat === "darwin") {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        'POSIX path of (choose folder with prompt "Select your work folder")',
      ]);
      return stdout.trim() || null;
    }
    if (plat === "win32") {
      const script =
        "Add-Type -AssemblyName System.Windows.Forms; " +
        "$f = New-Object System.Windows.Forms.FolderBrowserDialog; " +
        "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }";
      const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
      return stdout.trim() || null;
    }
    const { stdout } = await execFileAsync("zenity", ["--file-selection", "--directory"]);
    return stdout.trim() || null;
  } catch {
    return null; // cancelled, or the picker tool isn't installed — UI degrades to manual entry
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

function sendError(res: ServerResponse, err: unknown): void {
  if (err instanceof ArmClientError) {
    sendJson(res, 422, { error: { code: err.code, message: err.message } });
    return;
  }
  sendJson(res, 500, {
    error: { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) },
  });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Shape returned to the wizard page for a successful `/api/redeem` —
 *  `SetupResult` plus rendered connection guide steps (the client-side page
 *  has no access to `renderGuideSteps`, only fetch). */
type RedeemResponse = SetupResult & {
  connectionsNeeded: Array<SetupResult["connectionsNeeded"][number] & { guideSteps: string[] }>;
};

/** Start the wizard server. Resolves once listening; call `close()` when
 *  the flow is done (or leave it running — the process exits when the CLI
 *  does, same lifetime as any other `arm setup` invocation). */
export async function startInstallWizardServer(
  options: GuiServerOptions = {},
): Promise<GuiServerHandle> {
  const resolveFn = options.resolveFn ?? resolveFromSetupToken;
  const runSetupFn = options.runSetupFn ?? runSetup;
  const scanWorkFoldersFn = options.scanWorkFoldersFn ?? scanWorkFolders;
  const scanInstalledToolsFn = options.scanInstalledToolsFn ?? scanInstalledTools;
  const classifyPainPointsFn = options.classifyPainPointsFn ?? classifyPainPoints;
  const pickFolderFn = options.pickFolderFn ?? defaultPickFolder;
  const sendChatMessageFn = options.sendChatMessageFn ?? sendChatMessage;
  const armProxyUrl = options.armProxyUrl ?? DEFAULT_ARM_PROXY_URL;

  // Proxy credentials captured once redemption succeeds — the chat
  // assistant needs them (it talks to the tenant's own proxy, same as
  // any other agent call), and only exists once the tenant/agent identity
  // is known. This server serves exactly one install session at a time
  // (a local wizard for one employee), so module-scoped mutable state is
  // the right amount of "session" here — no multi-user concern.
  let chatCredentials:
    { armProxyUrl: string; agentToken: string; subAccountId: string; tenantId: string } | undefined;

  const server: Server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(WIZARD_HTML);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/redeem") {
        const body = await readJsonBody(req);
        const token = String(body["token"] ?? "");
        const controlPlaneUrl = String(body["controlPlaneUrl"] ?? "");
        if (!token || !controlPlaneUrl) {
          sendJson(res, 400, {
            error: { code: "BAD_REQUEST", message: "token and controlPlaneUrl are required" },
          });
          return;
        }
        const resolved: SetupArgs = await resolveFn({ token, controlPlaneUrl });
        if (resolved.agentToken !== undefined) {
          chatCredentials = {
            armProxyUrl: resolved.armProxyUrl,
            agentToken: resolved.agentToken,
            subAccountId: resolved.subAccountId,
            tenantId: resolved.tenantId,
          };
        }
        // `resolved.armProxyUrl` is always populated by resolveFromSetupToken
        // (falls back to controlPlaneUrl itself if the redemption response
        // carried no proxy_url) — this GUI server's own `armProxyUrl` default
        // never applies to the redeem path, only to a future direct-role
        // path that doesn't go through redemption.
        const result = await runSetupFn({
          ...(options.dataPlaneUrl !== undefined ? { dataPlaneUrl: options.dataPlaneUrl } : {}),
          ...(options.agentHome !== undefined ? { agentHome: options.agentHome } : {}),
          ...(options.agentToken !== undefined ? { agentToken: options.agentToken } : {}),
          // Redemption response is authoritative — a tenant-specific data-
          // plane URL or a control-plane-minted agent token (Invariant 4)
          // always wins over these local defaults, never the reverse.
          ...resolved,
        });
        const response: RedeemResponse = {
          ...result,
          connectionsNeeded: result.connectionsNeeded.map((entry) => ({
            ...entry,
            guideSteps: renderGuideSteps(entry),
          })),
        };
        sendJson(res, 200, response);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/refine") {
        const body = await readJsonBody(req);
        const painPoints = String(body["painPoints"] ?? "").trim();
        // Accepts the plural (the wizard's multi-project "Add folder" picker)
        // and, for back-compat with any caller still on the old shape, the
        // singular too — both fold into the same folder list.
        const folderPathsRaw = body["folderPaths"];
        const folderPaths = (Array.isArray(folderPathsRaw) ? folderPathsRaw.map(String) : [])
          .concat(String(body["folderPath"] ?? ""))
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        const painPointTags: PainPointTag[] =
          painPoints.length > 0 ? classifyPainPointsFn(painPoints) : [];
        const folderScan: FolderScanResult | undefined =
          folderPaths.length > 0 ? await scanWorkFoldersFn(folderPaths) : undefined;
        const installedTools: DetectedTool[] = await scanInstalledToolsFn();
        sendJson(res, 200, { painPointTags, folderScan, installedTools });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/pick-folder") {
        const path = await pickFolderFn();
        sendJson(res, 200, { path });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!chatCredentials) {
          sendJson(res, 409, {
            error: {
              code: "BAD_REQUEST",
              message: "install first — the assistant needs your tenant's proxy connection",
            },
          });
          return;
        }
        const body = await readJsonBody(req);
        const rawMessages = body["messages"];
        const messages: ChatMessage[] = (Array.isArray(rawMessages) ? rawMessages : [])
          .filter(
            (m): m is { role: string; content: string } =>
              typeof m === "object" &&
              m !== null &&
              typeof (m as Record<string, unknown>)["content"] === "string",
          )
          .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          }));
        if (messages.length === 0) {
          sendJson(res, 400, {
            error: { code: "BAD_REQUEST", message: "messages must include at least one entry" },
          });
          return;
        }
        const reply = await sendChatMessageFn({ ...chatCredentials, messages });
        sendJson(res, 200, { role: "assistant", content: reply });
        return;
      }

      sendJson(res, 404, {
        error: { code: "NOT_FOUND", message: `no route for ${req.method} ${url.pathname}` },
      });
    } catch (err) {
      sendError(res, err);
    }
  }

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : (options.port ?? 0);
  const url = `http://127.0.0.1:${port}/`;

  return {
    url,
    port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

/** Open the user's default browser to a URL — the other half of "no
 *  terminal": the CLI calls this right after the server starts, so the
 *  window that appears is a browser, never a console. */
export async function openInBrowser(url: string): Promise<void> {
  const plat = osPlatform();
  const command = plat === "darwin" ? "open" : plat === "win32" ? "start" : "xdg-open";
  const args = plat === "win32" ? ["", url] : [url]; // `start` needs an empty title arg on Windows
  try {
    if (plat === "win32") {
      await execFileAsync("cmd", ["/c", "start", "", url]);
    } else {
      await execFileAsync(command, args);
    }
  } catch {
    // Never fatal — the URL is also printed by the caller as a fallback.
  }
}
