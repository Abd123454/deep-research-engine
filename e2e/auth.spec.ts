// E2E: Auth — signup, login, password reset.
//
// These tests exercise the auth UI against the running dev server. They do
// NOT depend on LLM API keys — only the auth API (which uses SQLite/Postgres
// + bcrypt + optional Resend email).
//
// Run: bunx playwright test e2e/auth.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Auth — signup, login, reset", () => {
  test("signup fills form and redirects to home", async ({ page }) => {
    await page.goto("/register", { timeout: 10_000 });

    // Use a unique email per test run so registration never collides with a
    // previously created account.
    const uniqueEmail = `e2e+signup+${Date.now()}@test.localhost`;

    await page.locator("#name").fill("E2E Test User", { timeout: 10_000 });
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("password123");

    // COPPA / GDPR Art. 8 age gate — the submit button stays disabled
    // until the user checks the "I am at least 13 years old" box.
    await page.locator("#ageConfirmed").check({ timeout: 10_000 });

    // Submit the form.
    await page.locator('button[type="submit"]').click();

    // After registration the page auto-signs-in and pushes to "/".
    await page.waitForURL("/", { timeout: 15_000 });

    // The home page should render the unified interface (header logo / app name).
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });

  test("login with wrong credentials shows error", async ({ page }) => {
    await page.goto("/login", { timeout: 10_000 });

    await page.locator("#email").fill("nonexistent@test.localhost", { timeout: 10_000 });
    await page.locator("#password").fill("definitely-wrong-password");
    await page.locator('button[type="submit"]').click();

    // The login page sets an "Invalid email or password." error on failure.
    await expect(
      page.locator("text=Invalid email or password")
    ).toBeVisible({ timeout: 10_000 });

    // We should still be on /login (no redirect).
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password shows success message", async ({ page }) => {
    await page.goto("/login", { timeout: 10_000 });

    // Click the "Forgot password?" link — added alongside this test.
    const forgotLink = page.locator('button:has-text("Forgot password?"), a:has-text("Forgot password?")').first();
    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
    await forgotLink.click();

    // Should navigate to /forgot-password.
    await page.waitForURL(/\/forgot-password/, { timeout: 10_000 });

    // Fill the email field and submit.
    await page.locator("#email").fill(`e2e+reset+${Date.now()}@test.localhost`, { timeout: 10_000 });
    await page.locator('button[type="submit"]').click();

    // The page shows a success status with role="status".
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=reset link has been sent')).toBeVisible({ timeout: 10_000 });
  });
});
