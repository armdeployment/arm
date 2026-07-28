/**
 * ARM CLI (spec §9 1.2).
 *
 * Commands:
 *   arm data-plane install   Register tenant → pull delegate key → render chart → apply.
 *   arm agent init           Detect agent type → write config → verify metered round-trip.
 *
 * Stub for 1.2 scaffold. Real implementation when Helm/Terraform packaging ships.
 */

export function main(args: string[]) {
  const cmd = args[2] ?? "help";

  switch (cmd) {
    case "data-plane":
      console.log(`
ARM Data Plane Installer (spec §9 1.2)
──────────────────────────────────────
  1. Register tenant with control plane
  2. Pull delegate key
  3. Render Helm chart with tenant config
  4. Apply to cluster

  Usage: arm data-plane install [--tenant-id <id>] [--provider <aws|gcp|azure>]
  Stub: real installation lands with Helm chart packaging.
      `);
      break;

    case "agent":
      console.log(`
ARM Agent Init (spec §8.1)
─────────────────────────
  Detect agent type → write config → verify metered round-trip.

  Supported agent types: opencode, claude code, copilot, Pi
  Discovery: /.well-known/arm-agent

  Usage: arm agent init [--type <type>] [--tenant-id <id>]
  Stub: real onboarding lands with data-plane proxy.
      `);
      break;

    default:
      console.log(`
ARM CLI — Agent Resource Management
───────────────────────────────────
  arm data-plane install   Install data plane in customer VPC
  arm agent init           Onboard an agent to ARM
  arm help                 Show this help
      `);
  }
}

// Run from command line
if (process.argv[1]?.endsWith("arm") || process.argv[1]?.includes("cli")) {
  main(process.argv);
}
