/**
 * guardrail: package-drift (D9).
 *
 * Installed package versions must trail the preset release channel by ≤ N
 * versions, or surface a guided upgrade — mirrors policy-cache freshness (D5,
 * docs/solutions/2026-08-13-d9-work-packages.md §Consequences → Guardrails).
 *
 * The channel is an ordered semver list (highest last); lag =
 * `channel.length - 1 - channel.indexOf(installedVersion)`. An installed
 * version missing from the channel, or lagging more than `maxLag` versions, is
 * red.
 *
 * Pure-function form (`checkPackageDrift`) is exercised by mutation proofs.
 * The registered check verifies the drift-detection substrate ships: every
 * `workPackages` entry in the profile presets must carry a semver-ish
 * `minAgentVersion` (the client-version gate). The channel comparison itself
 * is runtime data. If no `minAgentVersion` gates are found, the registered
 * check FAILS LOUDLY (spec §14.2 vacuous-guard rule).
 */

import { register, type CheckResult } from "../types.js";
import * as path from "node:path";
import { profileScans, SEMVER_ISH, valuesForKey } from "./d9-shared.js";

/** An installed package against its release channel. */
export interface InstalledPackageVersion {
  roleKey: string;
  installedVersion: string;
  /** Ordered release channel, lowest → highest (highest last). */
  channel: string[];
}

export const DEFAULT_MAX_LAG = 1;

/** Pure function form — used by mutation proofs. */
export function checkPackageDrift(
  installed: InstalledPackageVersion[],
  maxLag = DEFAULT_MAX_LAG,
): CheckResult {
  const violations: string[] = [];

  for (const [i, p] of installed.entries()) {
    if (p.channel.length === 0) {
      violations.push(
        `index ${i}: role "${p.roleKey}" has an empty release channel — cannot compute drift`,
      );
      continue;
    }
    const idx = p.channel.indexOf(p.installedVersion);
    if (idx === -1) {
      violations.push(
        `index ${i}: role "${p.roleKey}" installed version ${p.installedVersion} is not in release channel [${p.channel.join(", ")}]`,
      );
      continue;
    }
    const lag = p.channel.length - 1 - idx;
    if (lag > maxLag) {
      const latest = p.channel[p.channel.length - 1]!;
      violations.push(
        `index ${i}: role "${p.roleKey}" trails release channel by ${lag} version(s) (max ${maxLag}) — installed ${p.installedVersion}, latest ${latest}; surface a guided upgrade`,
      );
    }
  }

  const scanned = installed.length;
  if (violations.length > 0) {
    return {
      id: "package-drift",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }
  return {
    id: "package-drift",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

// ── Registered check (scans shipped profile presets) ───────────────────────

register({
  id: "package-drift",
  description:
    "Every profile workPackages entry must carry a semver-ish minAgentVersion — the client-version gate that makes release-channel drift detectable (D9).",
  invariant:
    "D9: installed package versions must trail the preset release channel by ≤ N versions or surface a guided upgrade (mirrors policy-cache freshness, D5)",
  run: () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const scans = profileScans(repoRoot);

    if (scans.length === 0) {
      return {
        id: "package-drift",
        status: "fail" as const,
        detail:
          "No profile preset files found under packages/profiles/src/*.profile.ts — guard scanning the wrong directory.",
        scanned: 0,
        assertsNegative: true,
      };
    }

    const wpScans = scans.filter((s) => s.hasWorkPackages);
    if (wpScans.length === 0) {
      return {
        id: "package-drift",
        status: "fail" as const,
        detail:
          `No 'workPackages' arrays found in ${scans.length} profile preset file(s) ` +
          `(${scans.map((s) => s.file).join(", ")}) — VACUOUS GUARD: asserted over empty input (spec §14.2).`,
        scanned: 0,
        assertsNegative: true,
      };
    }

    const issues: string[] = [];
    let versionCount = 0;
    for (const s of wpScans) {
      if (s.block === null) {
        issues.push(
          `${s.file}: 'workPackages' present but not an inline array — cannot verify minAgentVersion gates`,
        );
        continue;
      }
      const minVersions = valuesForKey(s.block, "minAgentVersion");
      if (minVersions.length === 0) {
        issues.push(
          `${s.file}: workPackages defined but no 'minAgentVersion' gates — VACUOUS GUARD: drift substrate missing (spec §14.2)`,
        );
        continue;
      }
      for (const v of minVersions) {
        if (!SEMVER_ISH.test(v)) {
          issues.push(
            `${s.file}: non-semver minAgentVersion "${v}" — client-version gate must be semver-ish`,
          );
        }
      }
      versionCount += minVersions.length;
    }

    if (issues.length > 0) {
      return {
        id: "package-drift",
        status: "fail" as const,
        detail: issues.join("\n"),
        scanned: versionCount,
        assertsNegative: true,
      };
    }

    return {
      id: "package-drift",
      status: "pass" as const,
      scanned: versionCount,
      assertsNegative: true,
    };
  },
});
