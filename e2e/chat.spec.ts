// E2E: Chat — send message, receive stream UI, multi-turn.
//
// These tests verify the chat UI. They do NOT wait for LLM responses — they
// verify that:
//   1. The ChatCard renders with the user's message
//   2. A follow-up input + send button appear after the assistant responds
//      (or while streaming)
//
// In auto mode (the default), short queries produce a ChatCard.
//
// Run: bunx playwright test e2e/chat.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Chat — single and multi-turn", () => {
  test("sending a chat message renders a conversation card", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const message = "Hello, what can you do?";
    await textarea.fill(message);

    // Default mode is "Auto" — short prompts route to ChatCard.
    await page.locator('button[aria-label="Send"]').click();

    // The ChatCard header says "Conversation".
    await expect(page.locator('text=Conversation').first()).toBeVisible({ timeout: 10_000 });

    // The user's message should appear in the conversation.
    await expect(page.locator(`text=${message}`).first()).toBeVisible({ timeout: 10_000 });

    // The input should clear after sending.
    await expect(textarea).toHaveValue("", { timeout: 10_000 });
  });

  test("follow-up input is present in the chat card", async ({ page }) => {
    await page.goto("/", { timeout: 10_000 });

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill("Tell me a joke");
    await page.locator('button[aria-label="Send"]').click();

    // The ChatCard header appears.
    await expect(page.locator('text=Conversation').first()).toBeVisible({ timeout: 10_000 });

    // The follow-up input has placeholder "Ask a follow-up...".
    const followUp = page.locator('textarea[placeholder="Ask a follow-up..."]').first();
    await expect(followUp).toBeVisible({ timeout: 10_000 });

    // Type a follow-up message.
    const followText = "Tell me another one";
    await followUp.fill(followText);

    // Verify the follow-up input contains the typed text.
    await expect(followUp).toHaveValue(followText, { timeout: 10_000 });
  });
});
