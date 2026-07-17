// GET /api/billing/subscription — get current user's subscription status
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan, PLANS } from "@/lib/stripe";
import { getUserId, requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const plan = await getUserPlan(userId);
  return NextResponse.json({ plan, planDetails: PLANS[plan] });
}
