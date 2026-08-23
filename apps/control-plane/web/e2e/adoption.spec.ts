import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * /adoption, /rollout, /library e2e (docs/guides/02-server-panels.md §7):
 *   "land on /adoption → filter by department → drill into a stall →
 *   navigate to /library prefiltered by the gap."
 *
 * The literal "drill into a stall → navigate to /library prefiltered by the
 * gap" hop can't be exercised end-to-end yet: `library.gaps` is a Wave-0
 * placeholder (packages/trpc/src/library-router.ts, owned by the `library`
 * Wave-1 agent) that always returns an empty array until that module lands
 * — so the Gaps panel never renders a live link today. What IS real and
 * tested below: filtering /adoption by department (scope), drilling into
 * the funnel by clicking a step (filters the Recent Activations table —
 * the funnel's own version of "drill into a stall"), and /library loading
 * with a `?gap=` query param structurally (the same URL shape
 * components/adoption/gaps-panel.tsx builds its links with).
 */

test.describe("/adoption", () => {
  test("renders all six panels with real data", async ({ page }) => {
    await page.goto("/adoption");
    await expect(page.getByRole("heading", { name: "Adoption", exact: true })).toBeVisible();

    await expect(page.getByText("Activation Funnel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Weekly Active")).toBeVisible();
    await expect(page.getByText("Where Adoption Stalls")).toBeVisible();
    await expect(page.getByText("Time to Value")).toBeVisible();
    await expect(page.getByText("Coverage")).toBeVisible();
    await expect(page.getByText("Coverage Gaps")).toBeVisible();
    await expect(page.getByText("Recent Activations")).toBeVisible();

    // Funnel steps render with real fixture counts (guide 02 §5.1: not flattering — abandonment is visible)
    await expect(page.getByText("Invited")).toBeVisible();
    await expect(page.getByText("Weekly active")).toBeVisible();

    // Coverage gap is visible (process_engineer — no published package)
    await expect(page.getByText(/no package — gap/i)).toBeVisible();

    // sample-data badge (guide 02 §5.1 — ARM_FIXTURE_MODE=1 default)
    await expect(page.getByTestId("sample-data-badge").first()).toBeVisible();
  });

  test("filtering by department (scope) narrows the funnel", async ({ page }) => {
    await page.goto("/adoption?scope=department:dept_qa");
    await expect(page.getByText("Activation Funnel")).toBeVisible({ timeout: 15_000 });
    // Quality Assurance is a small department (42 headcount) — funnel counts
    // should be well below the org-wide totals visible on the unscoped page.
    await expect(page.getByRole("heading", { name: "Quality Assurance" })).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a funnel step filters the Recent Activations table below it", async ({ page }) => {
    await page.goto("/adoption");
    await expect(page.getByText("Activation Funnel")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /weekly active/i }).click();
    await expect(page.getByText(/filtered to step: weekly_active/i)).toBeVisible();
  });

  test("axe accessibility pass", async ({ page }) => {
    await page.goto("/adoption");
    await expect(page.getByText("Activation Funnel")).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("/rollout", () => {
  test("renders against the placeholder onboarding router without errors", async ({ page }) => {
    await page.goto("/rollout");
    await expect(page.getByRole("heading", { name: "Rollout", exact: true })).toBeVisible();
    await expect(page.getByText("Questionnaire")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Campaigns")).toBeVisible();
    await expect(page.getByText("Download Artifacts")).toBeVisible();
    await expect(page.getByText("Live Campaign Funnel")).toBeVisible();
    // Well-built empty state (guide 02 §3) — no published questionnaire yet
    await expect(page.getByText(/no questionnaire published yet/i)).toBeVisible({ timeout: 10_000 });
  });

  test("axe accessibility pass", async ({ page }) => {
    await page.goto("/rollout");
    await expect(page.getByText(/no questionnaire published yet/i)).toBeVisible({ timeout: 10_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("/library", () => {
  test("/catalog redirects to /library", async ({ page }) => {
    await page.goto("/catalog");
    await page.waitForURL("/library");
    expect(page.url()).toContain("/library");
  });

  test("Packages tab reads real catalog.listPackages data", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
    await expect(page.getByText("Quality Engineer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("quality_engineer")).toBeVisible();
  });

  test("Request button calls catalog.requestAssignment for real", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByText("Quality Engineer")).toBeVisible({ timeout: 15_000 });
    const card = page.locator("div", { hasText: "Quality Engineer" }).first();
    const requestButton = page.getByRole("button", { name: "Request" }).first();
    await requestButton.click();
    await expect(page.getByRole("button", { name: /requested/i }).first()).toBeVisible({ timeout: 10_000 });
    void card;
  });

  test("Components and Discovery tabs render well-built empty states", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("tab", { name: "Components" }).click();
    await expect(page.getByText(/no components published yet/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("tab", { name: "Discovery" }).click();
    await expect(page.getByText(/no discovery candidates pending triage/i)).toBeVisible({ timeout: 10_000 });
  });

  test("axe accessibility pass", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByText("Quality Engineer")).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("sidebar IA (guide 02 §1)", () => {
  test("new nav sections are present", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Dashboard", "Adoption", "Rollout", "Library", "Assignments", "Governance", "Agents", "Spend"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    // Catalog is retired from the nav
    await expect(page.getByRole("link", { name: "Catalog", exact: true })).toHaveCount(0);
  });
});
