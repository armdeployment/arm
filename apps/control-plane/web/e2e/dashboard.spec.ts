import { test, expect } from "@playwright/test";

/**
 * Token-conservative smoke tests for the hierarchical drill-down dashboard.
 * Uses exact: true + role selectors to avoid strict-mode ambiguity.
 */

test.describe("ARM dashboard — org-root (CEO view)", () => {
  test("shows org summary + department drill-down cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();

    // Stat cards with rolled-up org totals — .first() because tree view root also shows $7,150
    await expect(page.getByText("$7,150").first()).toBeVisible();
    await expect(page.getByText("18 agents").first()).toBeVisible();

    // Department cards — scoped to avoid ambiguity with agent names
    await expect(page.getByRole("link", { name: /Engineering department/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Operations department/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Data department/ })).toBeVisible();

    // Engineering card shows rolled-up spend — scope to the drill-down card link
    await expect(page.getByRole("link", { name: /Engineering department/ }).getByText("$3,335")).toBeVisible();

    // Spend tree visualizations (treemap + indented tree)
    await expect(page.getByText("Spend by Org Tree", { exact: true })).toBeVisible();
    await expect(page.getByText("Spend by Org Tree (Full Hierarchy)")).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Dashboard", "Agents", "Spend", "Access", "Audit"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });
});

test.describe("ARM dashboard — drill-down", () => {
  test("clicking a department navigates to its scoped view", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Operations department/ }).click();
    await page.waitForURL(/scope=department/);

    expect(page.url()).toContain("scope=department:dept_ops");

    // After full-page navigation, tRPC queries need time to resolve.
    // Use longer timeouts for data-dependent assertions.
    await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();

    // Operations rolled-up values — .first() because both the stat card and SRE group card show $3,365
    await expect(page.getByText("$3,365").first()).toBeVisible({ timeout: 10_000 });

    // Shows child groups (SRE) — use the group card link to avoid ambiguity with treemap/tree-view
    await expect(page.getByRole("link", { name: /SRE group/ })).toBeVisible({ timeout: 10_000 });
  });

  test("breadcrumb navigates back up to org root", async ({ page }) => {
    await page.goto("/?scope=department:dept_eng");

    await page.getByRole("link", { name: "Acme Corp" }).click();
    await page.waitForURL("/");
    expect(page.url()).not.toContain("scope=");
  });
});

test.describe("sub-pages (scope-aware)", () => {
  test("/agents shows all agents at org level", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible();
    await expect(page.getByText("incident-triage")).toBeVisible();
    await expect(page.getByText("code-review-bot")).toBeVisible();
    await expect(page.getByText("SEV-1 incident triage")).toBeVisible();
  });

  test("/agents scoped to a team shows only that team's agents", async ({ page }) => {
    await page.goto("/agents?scope=team:team_ir");
    await expect(page.getByText("incident-triage")).toBeVisible();
    await expect(page.getByText("code-review-bot")).not.toBeVisible();
  });

  test("/spend shows cost breakdown with drill-down cards", async ({ page }) => {
    await page.goto("/spend");
    await expect(page.getByRole("heading", { name: "Spend", exact: true })).toBeVisible();
    await expect(page.getByText("Total Monthly")).toBeVisible();
    await expect(page.getByText("$7,150")).toBeVisible();
    await expect(page.getByRole("link", { name: /Engineering department/ })).toBeVisible();
  });

  test("/access renders JIT approval queue", async ({ page }) => {
    await page.goto("/access");
    await expect(page.getByRole("heading", { name: "Access", exact: true })).toBeVisible();
    await expect(page.getByText("Pending Approvals")).toBeVisible();
    await expect(page.getByText("SEV-1 incident")).toBeVisible();
  });

  test("/audit renders placeholder", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Audit", exact: true })).toBeVisible();
    await expect(page.getByText("access_audit_event")).toBeVisible();
  });
});
