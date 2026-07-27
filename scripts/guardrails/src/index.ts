/**
 * Guardrail entry point. Importing this module registers all checks.
 * The runner (run.ts) reads the populated REGISTRY.
 */

import "./checks/tenant-isolation.js";
import "./checks/no-content-egress.js";
import "./checks/no-secret-dumps.js";
import "./checks/boundaries.js";
import "./checks/safe-render.js";

export * from "./types.js";
export { checkTenantIsolation, shapeOf } from "./checks/tenant-isolation.js";
export { checkNoContentEgress, parseColumns } from "./checks/no-content-egress.js";
export { checkNoSecretDumps } from "./checks/no-secret-dumps.js";
export { checkBoundaries } from "./checks/boundaries.js";
export { checkSafeRender } from "./checks/safe-render.js";
