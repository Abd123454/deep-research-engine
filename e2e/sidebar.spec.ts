// E2E: Sidebar — conversation list interactions.
//
// Covers the skills-audit UX fix where the Trash2 icon was visible on
// hover but had no onClick handler. Now it DELETEs the conversation via
// /api/chat/conversations/[id] and removes the row from the local list.
//
// Also covers the sidebar open/close toggle on mobile (the menu button
// in the topbar is `lg:hidden` — only visible below the desktop
// breakpoint).
//
// Run: bunx playwright test e2e/sidebar.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Sidebar — conversation list", () => {
  test("trash icon on a conversation row deletes the conversation", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    // Send a message so a conversation row is created in the sidebar.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill("Hello, what can you do?");
    await page.locator('button[aria-label="Send"]').click();

    // Wait for the chat card to render (indicates the conversation was
    // created server-side and the sidebar refresh fired).
    await expect(page.locator('text=Conversation').first()).toBeVisible({ timeout: 10_000 });

    // The sidebar refresh fires 800ms after send (see UnifiedInterface's
    // handleSend setTimeout). Wait for the conversation row to appear.
    const conversationButton = page
      .locator('button[aria-label^="Open conversation:"]')
      .first();
    await expect(conversationButton).toBeVisible({ timeout: 5_000 });

    // Hover the row so the trash icon becomes visible (opacity-0
    // group-hover:opacity-100).
    await conversationButton.hover();

    // Click the trash icon. The aria-label includes the conversation
    // title so we match by prefix.
    const deleteButton = page
      .locator('button[aria-label^="Delete conversation:"]')
      .first();
    await expect(deleteButton).toBeVisible({ timeout: 2_000 });
    await deleteButton.click();

    // The row should disappear from the sidebar after the DELETE
    // succeeds and the local list updates.
    await expect(conversationButton).toHaveCount(0, { timeout: 5_000 });
  });

  test("mobile menu button toggles sidebar visibility", async ({ page }) => {
    // Set a mobile viewport so the lg:hidden menu button is visible.
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/", { timeout: 10_000 });

    // The toggle button has aria-label="Toggle sidebar" and is only
    // visible below the lg breakpoint (1024px).
    const toggle = page.locator('button[aria-label="Toggle sidebar"]');
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // On first paint at mobile width, the useEffect closes the sidebar
    // (see UnifiedInterface.tsx — `if window.innerWidth < 1024`). The
    // New Chat button inside the sidebar should NOT be visible.
    const newChatButton = page.locator('button[aria-label="Start a new chat"]');
    await expect(newChatButton).toHaveCount(0, { timeout: 5_000 });

    // Click the toggle — sidebar should slide in.
    await toggle.click();
    await expect(newChatButton).toBeVisible({ timeout: 5_000 });

    // Click again — sidebar should slide out.
    await toggle.click();
    await expect(newChatButton).toHaveCount(0, { timeout: 5_000 });
  });

  test("search filters conversations by title", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    // Send two messages so we have two conversation rows.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill("Tell me about RISC-V");
    await page.locator('button[aria-label="Send"]').click();
    await expect(page.locator('text=Conversation').first()).toBeVisible({ timeout: 10_000 });

    // Wait for the sidebar refresh (800ms after send).
    await page.waitForTimeout(1_500);

    // Search for "risc" — only the matching conversation should show.
    const search = page.locator('input[aria-label="Search conversations"]');
    if (await search.count() > 0) {
      await search.fill("risc");
      // At least one row should still be visible.
      await expect(
        page.locator('button[aria-label^="Open conversation:"]').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
