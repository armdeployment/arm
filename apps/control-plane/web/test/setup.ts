/**
 * vitest setup — jsdom environment, testing-library matchers, and cleanup
 * between component tests (docs/guides/02-server-panels.md §7: "Component
 * tests (vitest) for every new panel: loading, empty, error, populated").
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
