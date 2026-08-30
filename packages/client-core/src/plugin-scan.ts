/**
 * Installed-tool scan (installation wizard step 4,
 * docs/solutions/2026-08-25-gtm-market-tiers-and-wizard-plan.md).
 *
 * Local-only, opt-in: checks for the PRESENCE of known application install
 * paths — never reads app data, never inventories the full filesystem,
 * never opens or reads any of the paths it checks. Maps a detected app to a
 * catalog component slug so `arm setup` can pre-select (or skip) the
 * matching connector. `pathExists` is injectable so tests never touch the
 * real filesystem or assume a real app is installed.
 */

import { access } from "node:fs/promises";
import { platform as osPlatform } from "node:os";

export interface DetectedTool {
  id: string;
  label: string;
  componentSlug: string;
}

interface ToolProbe {
  id: string;
  label: string;
  componentSlug: string;
  /** Common default install path per platform — best-effort, not a registry
   *  query. A tenant can always connect a tool this misses via the normal
   *  connections wizard; this only ever pre-selects, never gates. */
  paths: Partial<Record<NodeJS.Platform, string[]>>;
}

const TOOL_PROBES: ToolProbe[] = [
  {
    id: "vscode",
    label: "Visual Studio Code",
    componentSlug: "vscode",
    paths: {
      darwin: ["/Applications/Visual Studio Code.app"],
      win32: ["C:\\Program Files\\Microsoft VS Code"],
      linux: ["/usr/share/code", "/snap/code"],
    },
  },
  {
    id: "github-desktop",
    label: "GitHub Desktop",
    componentSlug: "git.repo",
    paths: {
      darwin: ["/Applications/GitHub Desktop.app"],
      win32: ["C:\\Users\\Public\\AppData\\Local\\GitHubDesktop"],
    },
  },
  {
    id: "docker-desktop",
    label: "Docker Desktop",
    componentSlug: "deploy.cd",
    paths: {
      darwin: ["/Applications/Docker.app"],
      win32: ["C:\\Program Files\\Docker\\Docker"],
    },
  },
  {
    id: "slack",
    label: "Slack",
    componentSlug: "slack",
    paths: {
      darwin: ["/Applications/Slack.app"],
      win32: ["C:\\Users\\Public\\AppData\\Local\\slack"],
    },
  },
  {
    id: "teamcenter",
    label: "Siemens Teamcenter",
    componentSlug: "plm.teamcenter",
    paths: { win32: ["C:\\Program Files\\Siemens\\Teamcenter"] },
  },
  {
    id: "windchill",
    label: "PTC Windchill",
    componentSlug: "plm.windchill",
    paths: { win32: ["C:\\ptc\\Windchill"] },
  },
  {
    id: "solidworks",
    label: "SolidWorks",
    componentSlug: "cad.solidworks",
    paths: { win32: ["C:\\Program Files\\SOLIDWORKS Corp"] },
  },
  {
    id: "matlab",
    label: "MATLAB / Simulink",
    componentSlug: "mdl.matlab-simulink",
    paths: {
      darwin: ["/Applications/MATLAB.app"],
      win32: ["C:\\Program Files\\MATLAB"],
    },
  },
  {
    id: "star-ccm",
    label: "Simcenter STAR-CCM+",
    componentSlug: "sim.star-ccm",
    paths: {
      win32: ["C:\\Program Files\\Siemens\\STAR-CCM+"],
      linux: ["/opt/Siemens/STAR-CCM+"],
    },
  },
];

export type PathExistsFn = (path: string) => Promise<boolean>;

async function defaultPathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which known tools are installed on this machine. Pass `pathExists`
 * in tests to avoid touching the real filesystem; production callers should
 * omit it and get the real check.
 */
export async function scanInstalledTools(
  pathExists: PathExistsFn = defaultPathExists,
  platform: NodeJS.Platform = osPlatform(),
): Promise<DetectedTool[]> {
  const detected: DetectedTool[] = [];
  for (const probe of TOOL_PROBES) {
    const candidates = probe.paths[platform];
    if (!candidates) continue;
    for (const path of candidates) {
      if (await pathExists(path)) {
        detected.push({ id: probe.id, label: probe.label, componentSlug: probe.componentSlug });
        break;
      }
    }
  }
  return detected;
}
