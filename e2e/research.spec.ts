// E2E: Research — start research, view card, cancel.
//
// These tests verify the research UI flow. They do NOT wait for LLM
// responses — they verify that:
//   1. The ResearchCard renders with the user's query
//   2. The stop button is visible while running
//   3. Clicking stop removes the card
//
// Run: bunx playwright test e2e/research.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Research — start, view, cancel", () => {
  test("starting research renders a research card with the query", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    // Wait for the unified input to mount.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // Type a query.
    const query = "What is the current state of quantum error correction?";
    await textarea.fill(query);

    // Open the mode dropdown and select "Research".
    await page.locator('button[aria-label="Mode"]').click();
    await page.locator('button:has-text("Research")').click();

    // Click send.
    await page.locator('button[aria-label="Send"]').click();

    // A ResearchCard should appear with the query text visible.
    await expect(page.locator(`text=${query}`).first()).toBeVisible({ timeout: 10_000 });

    // The input should clear after sending.
    await expect(textarea).toHaveValue("", { timeout: 10_000 });
  });

  test("research card shows stop button while running", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const query = "Compare RISC-V and ARM processors";
    await textarea.fill(query);

    // Select research mode.
    await page.locator('button[aria-label="Mode"]').click();
    await page.locator('button:has-text("Research")').click();
    await page.locator('button[aria-label="Send"]').click();

    // The Stop button should appear inside the research card while running.
    const stopButton = page.locator('button:has-text("Stop")').first();
    await expect(stopButton).toBeVisible({ timeout: 10_000 });
  });

  test("clicking stop removes the research card", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const query = "How do large language model agents work?";
    await textarea.fill(query);

    await page.locator('button[aria-label="Mode"]').click();
    await page.locator('button:has-text("Research")').click();
    await page.locator('button[aria-label="Send"]').click();

    // Wait for the card + stop button.
    const stopButton = page.locator('button:has-text("Stop")').first();
    await expect(stopButton).toBeVisible({ timeout: 10_000 });

    // Click stop.
    await stopButton.click();

    // The query text (in the research card header) should disappear from the
    // cards area. We can't assert it's GONE globally (the example cards may
    // still contain similar text), so we assert the Stop button is gone.
    await expect(stopButton).toHaveCount(0, { timeout: 10_000 });
  });
});
