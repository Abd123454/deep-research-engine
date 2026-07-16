// GET /api/billing/usage — get current usage + limits
import { NextResponse } from "next/server";
import { getUserPlan, checkUsageLimit, PLANS } from "@/lib/stripe";

export async function GET() {
  const userId = "default"; // TODO: get from session
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
