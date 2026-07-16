// PostHog analytics — product analytics for tracking user behavior.
// Server-side client. Client-side uses posthog-js via PostHogProvider.

import { PostHog } from "posthog-node";
import { logger } from "./logger";

export const posthog = process.env.POSTHOG_KEY
  ? new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || "https://app.posthog.com",
    })
  : null;

export function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!posthog) return;
  try {
    posthog.capture({
      distinctId: userId,
      event,
      properties: properties || {},
    });
  } catch (err) {
    logger.warn({ err, event }, "PostHog capture failed");
  }
}

export function trackPageView(userId: string, path: string): void {
  trackEvent(userId, "page_view", { path });
}
