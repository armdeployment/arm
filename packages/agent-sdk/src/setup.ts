#!/usr/bin/env node
/**
 * ARM Agent SDK — CLI Setup
 *
 * Interactive setup for connecting your coding agent to ARM.
 * Usage:
 *   pnpm --filter @arm/agent-sdk setup
 *   # or: npx tsx packages/agent-sdk/src/setup.ts
 */

import { createInterface } from "node:readline";
import {
  AGENTS,
  generateAgentConfig,
  verifyConnection,
  type SetupInput,
} from "./index.js";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         ARM Agent SDK — Connect Your Coding Agent            ║");
  console.log("║  Route all LLM calls through ARM for identity, metering,     ║");
  console.log("║  budget enforcement, and DLP-gated model access.             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Step 1: Choose agent type
  const types = Object.entries(AGENTS);
  console.log("Supported agent types:");
  types.forEach(([key, agent], i) => {
    console.log(`  ${i + 1}. ${agent.displayName} (${key})`);
  });

  const choice = await ask("\nSelect agent type [1-5]: ");
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= types.length) {
    console.log("Invalid selection.");
    process.exit(1);
  }
  const [agentType, agent] = types[idx]!;

  // Step 2: Get ARM connection details
  console.log(`\n── Configuring ${agent.displayName} ──`);
  const tenantUrl = await ask("ARM tenant proxy URL [https://data.arm.acme.com]: ");
  const effectiveUrl = tenantUrl || "https://data.arm.acme.com";

  const subAccountId = await ask("Sub-account ID: ");
  if (!subAccountId) {
    console.log("Sub-account ID is required.");
    process.exit(1);
  }

  const apiKey = await ask("API key: ");
  if (!apiKey) {
    console.log("API key is required.");
    process.exit(1);
  }

  // Step 3: Generate config
  const input: SetupInput = {
    agentType,
    tenantUrl: effectiveUrl,
    subAccountId,
    apiKey,
  };

  console.log("\n▶ Generating configuration...");
  const result = generateAgentConfig(input);

  if (result.success) {
    console.log(result.message);

    // Step 4: Verify connection
    console.log("\n▶ Verifying connection to ARM proxy...");
    const verify = await verifyConnection(effectiveUrl);
    if (verify.ok) {
      console.log(`  ✓ ${verify.detail}`);
    } else {
      console.log(`  ⚠ ${verify.detail}`);
      console.log("  The proxy may not be running. Your config is saved — retry when the proxy is available.");
    }
  } else {
    console.log(`✗ Setup failed: ${result.message}`);
  }

  console.log("\n── Next Steps ──");
  console.log(`  1. Restart ${agent.displayName} to pick up the new config`);
  console.log("  2. Make a test LLM call — it will be routed through ARM");
  console.log("  3. Check the ARM dashboard for your agent's activity\n");

  rl.close();
}

void main();
