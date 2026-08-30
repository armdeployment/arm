/**
 * Tests for `arm refine` — parser + orchestration only, zero real
 * filesystem/network/TTY I/O (all three signal sources are injected). The
 * scan primitives themselves are covered by @arm/client-core's test suite.
 */

import { describe, it, expect, vi } from "vitest";
import { parseRefineArgs, runRefineCommand, printRefineSummary } from "../src/index.js";
import type { FolderScanResult, DetectedTool, PainPointTag } from "@arm/client-core";

const STUB_PAIN_TAGS: PainPointTag[] = [
  { tag: "budget_approval_pain", jobFunctionHint: "senior_manager", matchedKeywords: ["budget"] },
];
const STUB_FOLDER_SCAN: FolderScanResult = {
  filesScanned: 12,
  extensionCounts: { ".sldprt": 8 },
  tags: ["cad_heavy"],
};
const STUB_TOOLS: DetectedTool[] = [{ id: "teamcenter", label: "Siemens Teamcenter", componentSlug: "plm.teamcenter" }];

describe("parseRefineArgs", () => {
  it("parses both flags", () => {
    expect(parseRefineArgs(["--folder", "/home/alice/work", "--pain-points", "too many approvals"])).toEqual({
      folderPath: "/home/alice/work",
      painPoints: "too many approvals",
    });
  });

  it("parses a single flag", () => {
    expect(parseRefineArgs(["--folder", "/home/alice/work"])).toEqual({ folderPath: "/home/alice/work" });
  });

  it("returns an empty object for no flags — signals interactive mode", () => {
    expect(parseRefineArgs([])).toEqual({});
  });
});

describe("runRefineCommand (non-interactive — flags supplied)", () => {
  it("runs pain-point classification and installed-tools scan, skips folder scan when --folder omitted", async () => {
    const classifyPainPointsFn = vi.fn().mockReturnValue(STUB_PAIN_TAGS);
    const scanInstalledToolsFn = vi.fn().mockResolvedValue(STUB_TOOLS);
    const scanWorkFolderFn = vi.fn().mockResolvedValue(STUB_FOLDER_SCAN);

    const result = await runRefineCommand(["--pain-points", "budget approvals are painful"], {
      classifyPainPointsFn,
      scanInstalledToolsFn,
      scanWorkFolderFn,
    });

    expect(classifyPainPointsFn).toHaveBeenCalledWith("budget approvals are painful");
    expect(scanWorkFolderFn).not.toHaveBeenCalled();
    expect(scanInstalledToolsFn).toHaveBeenCalledOnce();
    expect(result.painPointTags).toEqual(STUB_PAIN_TAGS);
    expect(result.folderScan).toBeUndefined();
    expect(result.installedTools).toEqual(STUB_TOOLS);
  });

  it("runs folder scan when --folder supplied, skips pain-point classification when omitted", async () => {
    const classifyPainPointsFn = vi.fn().mockReturnValue([]);
    const scanInstalledToolsFn = vi.fn().mockResolvedValue([]);
    const scanWorkFolderFn = vi.fn().mockResolvedValue(STUB_FOLDER_SCAN);

    const result = await runRefineCommand(["--folder", "/home/alice/work"], {
      classifyPainPointsFn,
      scanInstalledToolsFn,
      scanWorkFolderFn,
    });

    expect(scanWorkFolderFn).toHaveBeenCalledWith("/home/alice/work");
    expect(classifyPainPointsFn).not.toHaveBeenCalled();
    expect(result.folderScan).toEqual(STUB_FOLDER_SCAN);
    expect(result.painPointTags).toEqual([]);
  });

  it("never calls the prompt function when flags are supplied", async () => {
    const promptFn = vi.fn();
    await runRefineCommand(["--pain-points", "x"], {
      promptFn,
      classifyPainPointsFn: () => [],
      scanInstalledToolsFn: async () => [],
    });
    expect(promptFn).not.toHaveBeenCalled();
  });
});

describe("runRefineCommand (interactive — no flags)", () => {
  it("prompts for both steps and skips each on an empty answer", async () => {
    const promptFn = vi.fn().mockResolvedValue("");
    const classifyPainPointsFn = vi.fn();
    const scanWorkFolderFn = vi.fn();
    const scanInstalledToolsFn = vi.fn().mockResolvedValue([]);

    const result = await runRefineCommand([], {
      promptFn,
      classifyPainPointsFn,
      scanWorkFolderFn,
      scanInstalledToolsFn,
    });

    expect(promptFn).toHaveBeenCalledTimes(2);
    expect(classifyPainPointsFn).not.toHaveBeenCalled();
    expect(scanWorkFolderFn).not.toHaveBeenCalled();
    expect(result.painPointTags).toEqual([]);
    expect(result.folderScan).toBeUndefined();
  });

  it("runs a step when the interactive prompt returns non-empty text", async () => {
    const promptFn = vi
      .fn()
      .mockResolvedValueOnce("budget approvals take forever")
      .mockResolvedValueOnce("");
    const classifyPainPointsFn = vi.fn().mockReturnValue(STUB_PAIN_TAGS);
    const scanInstalledToolsFn = vi.fn().mockResolvedValue([]);

    const result = await runRefineCommand([], { promptFn, classifyPainPointsFn, scanInstalledToolsFn });

    expect(classifyPainPointsFn).toHaveBeenCalledWith("budget approvals take forever");
    expect(result.painPointTags).toEqual(STUB_PAIN_TAGS);
  });
});

describe("printRefineSummary", () => {
  it("prints detected signals without throwing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printRefineSummary({ painPointTags: STUB_PAIN_TAGS, folderScan: STUB_FOLDER_SCAN, installedTools: STUB_TOOLS });
    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("budget_approval_pain");
    expect(output).toContain("cad_heavy");
    expect(output).toContain("plm.teamcenter");
    logSpy.mockRestore();
  });

  it("handles the fully-skipped case cleanly", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printRefineSummary({ painPointTags: [], installedTools: [] });
    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("skipped");
    logSpy.mockRestore();
  });
});
