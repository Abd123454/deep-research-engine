// E2E: Billing — view billing page, see plan cards.
//
// These tests verify the billing page UI:
//   1. All 4 plan cards (Free, Pro, Team, Enterprise) render
//   2. The free plan shows the "Current Plan" label by default
//
// The billing page calls /api/billing/subscription which returns { plan: "free" }
// when no Stripe customer is set up — no Stripe keys required.
//
// Run: bunx playwright test e2e/billing.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Billing — plan cards", () => {
  test("billing page shows all 4 plan cards", async ({ page }) => {
    await page.goto("/billing", { timeout: 10_000 });

    // Wait for the loading state to clear.
    await expect(page.locator("h1", { hasText: "Billing" })).toBeVisible({ timeout: 10_000 });

    // Each plan card has an <h3> with the plan name.
    const planNames = ["Free", "Pro", "Team", "Enterprise"];
    for (const name of planNames) {
      await expect(page.locator("h3", { hasText: name })).toBeVisible({ timeout: 10_000 });
    }
  });

  test("free plan is marked as Current Plan by default", async ({ page }) => {
    await page.goto("/billing", { timeout: 10_000 });

    await expect(page.locator("h1", { hasText: "Billing" })).toBeVisible({ timeout: 10_000 });

    // The "Current Plan" label appears once (on the Free card by default).
    await expect(page.locator('text=Current Plan')).toBeVisible({ timeout: 10_000 });

    // Verify only one "Current Plan" label is shown.
    await expect(page.locator('text=Current Plan')).toHaveCount(1, { timeout: 10_000 });
  });
});
