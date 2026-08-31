/**
 * `arm setup` (no args) — the default no-terminal path. `main()`'s own
 * no-args branch is intentionally NOT exercised here: it awaits a promise
 * that never resolves (the wizard server is meant to keep the process
 * alive), which would hang the test runner. `runSetupGuiCommand` is the
 * seam that owns "start the server, open the browser, print the URL" and
 * resolves once that's done — that's what's testable without hanging.
 */

import { describe, it, expect, vi } from "vitest";
import { runSetupGuiCommand } from "../src/index.js";
import type { GuiServerHandle } from "@arm/client-core";

const STUB_HANDLE: GuiServerHandle = {
  url: "http://127.0.0.1:54321/",
  port: 54321,
  close: async () => {},
};

describe("runSetupGuiCommand", () => {
  it("starts the wizard server and opens it in the browser", async () => {
    const startServerFn = vi.fn().mockResolvedValue(STUB_HANDLE);
    const openBrowserFn = vi.fn().mockResolvedValue(undefined);

    const handle = await runSetupGuiCommand({ startServerFn, openBrowserFn });

    expect(startServerFn).toHaveBeenCalledOnce();
    expect(openBrowserFn).toHaveBeenCalledWith(STUB_HANDLE.url);
    expect(handle).toBe(STUB_HANDLE);
  });

  it("prints the URL so it's visible even if the browser fails to open automatically", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runSetupGuiCommand({
      startServerFn: vi.fn().mockResolvedValue(STUB_HANDLE),
      openBrowserFn: vi.fn().mockResolvedValue(undefined),
    });
    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain(STUB_HANDLE.url);
    expect(output).toContain("--cli");
    logSpy.mockRestore();
  });

  it("propagates a failure to start the server rather than silently opening a dead URL", async () => {
    const startServerFn = vi.fn().mockRejectedValue(new Error("port already in use"));
    const openBrowserFn = vi.fn();
    await expect(runSetupGuiCommand({ startServerFn, openBrowserFn })).rejects.toThrow(
      "port already in use",
    );
    expect(openBrowserFn).not.toHaveBeenCalled();
  });
});
