// GET /api/billing/subscription — get current user's subscription status
import { NextResponse } from "next/server";
import { getUserPlan, PLANS } from "@/lib/stripe";

export async function GET() {
  const userId = "default"; // TODO: get from session
  const plan = await getUserPlan(userId);
  return NextResponse.json({ plan, planDetails: PLANS[plan] });
}
