// E2E: PWA — install prompt prerequisites.
//
// The InstallPrompt component only shows itself after the browser fires
// `beforeinstallprompt` (Chrome/Edge only, not in CI/test environments)
// and 30 seconds have passed. We can't reliably trigger it in a test, so
// instead we verify the prerequisites that make install possible:
//
//   1. The manifest <link> is present in the <head>
//   2. The manifest URL resolves to /manifest.json
//
// Run: bunx playwright test e2e/pwa.spec.ts

import { test, expect } from "@playwright/test";

test.describe("PWA — install prerequisites", () => {
  test("manifest link is present in the page head", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    // The Next.js metadata.manifest field generates a <link rel="manifest">
    // in the <head>.
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached({ timeout: 10_000 });

    // The href should point to /manifest.json.
    await expect(manifestLink).toHaveAttribute("href", /manifest\.json/, { timeout: 10_000 });

    // The theme-color meta is also a PWA installability signal.
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toBeAttached({ timeout: 10_000 });
  });
});
