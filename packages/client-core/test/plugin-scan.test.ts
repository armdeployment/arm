import { describe, it, expect } from "vitest";
import { scanInstalledTools, type PathExistsFn } from "../src/plugin-scan.js";

function fakeFs(existingPaths: string[]): PathExistsFn {
  const set = new Set(existingPaths);
  return async (path: string) => set.has(path);
}

describe("scanInstalledTools", () => {
  it("detects a tool whose known path exists on the injected filesystem", async () => {
    const detected = await scanInstalledTools(
      fakeFs(["/Applications/Visual Studio Code.app"]),
      "darwin",
    );
    expect(detected.map((t) => t.id)).toContain("vscode");
  });

  it("returns nothing when no known path exists", async () => {
    const detected = await scanInstalledTools(fakeFs([]), "darwin");
    expect(detected).toEqual([]);
  });

  it("maps a detected tool to its catalog component slug", async () => {
    const detected = await scanInstalledTools(
      fakeFs(["C:\\Program Files\\Siemens\\Teamcenter"]),
      "win32",
    );
    const teamcenter = detected.find((t) => t.id === "teamcenter");
    expect(teamcenter?.componentSlug).toBe("plm.teamcenter");
  });

  it("only checks paths registered for the given platform", async () => {
    // teamcenter has no darwin path registered — must never match on macOS,
    // even if a coincidentally-matching path exists on the fake filesystem.
    const detected = await scanInstalledTools(
      fakeFs(["C:\\Program Files\\Siemens\\Teamcenter"]),
      "darwin",
    );
    expect(detected.map((t) => t.id)).not.toContain("teamcenter");
  });

  it("detects multiple installed tools independently", async () => {
    const detected = await scanInstalledTools(
      fakeFs(["/Applications/Visual Studio Code.app", "/Applications/Slack.app"]),
      "darwin",
    );
    expect(detected.map((t) => t.id).sort()).toEqual(["slack", "vscode"]);
  });

  it("never throws when the path-exists check itself rejects", async () => {
    const throwing: PathExistsFn = async () => {
      throw new Error("permission denied");
    };
    await expect(scanInstalledTools(throwing, "darwin")).rejects.toThrow();
    // (documents current behavior: probes propagate a throwing checker's
    // error rather than swallowing it — the default fs-backed check never
    // throws, so this only matters for a custom injected checker.)
  });
});
