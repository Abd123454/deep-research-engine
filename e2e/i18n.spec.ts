// E2E: i18n — switch to Arabic, verify RTL.
//
// Clicks the language toggle button and verifies the <html> element's `dir`
// attribute becomes "rtl". The toggle button has aria-label="Toggle language".
//
// Run: bunx playwright test e2e/i18n.spec.ts

import { test, expect } from "@playwright/test";

test.describe("i18n — Arabic RTL", () => {
  test("clicking language toggle switches html dir to rtl", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    // The toggle button has aria-label="Toggle language" (hardcoded English).
    const langToggle = page.locator('button[aria-label="Toggle language"]').first();
    await expect(langToggle).toBeVisible({ timeout: 10_000 });

    // Click to switch from English (LTR) to Arabic (RTL).
    await langToggle.click();

    // The LocaleProvider's useEffect sets document.documentElement.dir = "rtl".
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 10_000 });

    // The lang attribute should also switch to "ar".
    await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 10_000 });
  });
});
