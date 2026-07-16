// E2E: Documents — upload PDF, ask questions.
//
// Verifies that attaching a PDF file produces a DocumentCard with the
// filename visible in its header. Does NOT wait for the upload/qa API to
// complete — the card renders immediately on attach + send.
//
// Run: bunx playwright test e2e/documents.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Documents — upload + Q&A", () => {
  test("attaching a PDF and sending renders a document card", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // Attach a fake PDF via the hidden file input.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake pdf content"),
    });

    // A file chip with the filename should appear in the input bar.
    await expect(page.locator('text=test-document.pdf').first()).toBeVisible({ timeout: 10_000 });

    // Type a question and send.
    const question = "What is this document about?";
    await textarea.fill(question);
    await page.locator('button[aria-label="Send"]').click();

    // A DocumentCard should appear with the filename in its header.
    await expect(page.locator('text=test-document.pdf').first()).toBeVisible({ timeout: 10_000 });

    // The input should clear after sending.
    await expect(textarea).toHaveValue("", { timeout: 10_000 });
  });
});
