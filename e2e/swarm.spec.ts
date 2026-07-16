// E2E: Swarm — start swarm, view agent outputs.
//
// Verifies that selecting Swarm mode and sending produces a SwarmCard with
// the task text. Does NOT wait for swarm agents to finish — just verifies
// the card renders with the correct header.
//
// Run: bunx playwright test e2e/swarm.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Swarm — start + view", () => {
  test("starting a swarm renders a swarm card with the task", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const task = "Research the top 3 AI agent frameworks and compare them";
    await textarea.fill(task);

    // Open the mode dropdown and select "Swarm".
    await page.locator('button[aria-label="Mode"]').click();
    await page.locator('button:has-text("Swarm")').click();

    // Click send.
    await page.locator('button[aria-label="Send"]').click();

    // The SwarmCard has a header labeled "Agent Swarm".
    await expect(page.locator('text=Agent Swarm').first()).toBeVisible({ timeout: 10_000 });

    // The task text should be visible in the card.
    await expect(page.locator(`text=${task}`).first()).toBeVisible({ timeout: 10_000 });

    // The input should clear after sending.
    await expect(textarea).toHaveValue("", { timeout: 10_000 });
  });
});
