// Plan enforcement — checks user's plan limits before processing requests.
// Used by /api/research/start and /api/chat to gate access.

import { enforcePlanLimit, incrementUsage, getUserPlan } from "./stripe";
import type { Plan } from "./stripe";

export { enforcePlanLimit, incrementUsage, getUserPlan };
export type { Plan };

/**
 * Check if a user can perform an action. If not, return the reason.
 * Usage:
 *   const check = await checkPlan("user-123", "research");
 *   if (!check.allowed) return Response.json({ error: check.reason }, { status: 403 });
 */
export async function checkPlan(
  userId: string,
  type: "research" | "chat" | "tokens"
): Promise<{ allowed: boolean; reason?: string }> {
  return enforcePlanLimit(userId, type);
}
