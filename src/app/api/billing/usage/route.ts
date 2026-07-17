// GET /api/billing/usage — get current usage + limits
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan, checkUsageLimit, PLANS } from "@/lib/stripe";
import { getUserId, requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const plan = await getUserPlan(userId);
  const [research, chat, tokens] = await Promise.all([
    checkUsageLimit(userId, "research"),
    checkUsageLimit(userId, "chat"),
    checkUsageLimit(userId, "tokens"),
  ]);

  return NextResponse.json({
    plan,
    planName: PLANS[plan].name,
    usage: { research, chat, tokens },
    features: PLANS[plan].features,
  });
}
