// E2E: Vision — upload image, get description UI.
//
// Verifies that attaching an image file (PNG) produces a DocumentCard with
// the filename visible. Does NOT wait for the vision API to return a
// description — the card renders immediately on attach + send.
//
// The vision API (/api/vision) requires an LLM key, so we only test the
// upload UI behavior, not the LLM response.
//
// Run: bunx playwright test e2e/vision.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Vision — image upload", () => {
  test("attaching an image renders a document card with the filename", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // 1x1 transparent PNG — minimum valid PNG payload.
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: pngBytes,
    });

    // File chip appears in the input bar.
    await expect(page.locator('text=test-image.png').first()).toBeVisible({ timeout: 10_000 });

    // Type a question about the image and send.
    await textarea.fill("What is in this image?");
    await page.locator('button[aria-label="Send"]').click();

    // The DocumentCard header should display the image filename.
    await expect(page.locator('text=test-image.png').first()).toBeVisible({ timeout: 10_000 });

    // The input should clear after sending.
    await expect(textarea).toHaveValue("", { timeout: 10_000 });
  });
});
