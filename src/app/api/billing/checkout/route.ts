// POST /api/billing/checkout — create Stripe Checkout Session
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, PLANS } from "@/lib/stripe";
import { getUserId, requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { plan?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan as keyof typeof PLANS;
  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PLANS[plan].priceId;
  if (!priceId) {
    return NextResponse.json({ error: "This plan has no Stripe price (contact sales for Enterprise)" }, { status: 400 });
  }

  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const origin = req.headers.get("origin") || "http://localhost:3000";

  const url = await createCheckoutSession(userId, priceId, `${origin}/billing?success=true`, `${origin}/billing?canceled=true`);
  if (!url) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  return NextResponse.json({ url });
}
