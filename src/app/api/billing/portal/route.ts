// POST /api/billing/portal — create Customer Portal session
import { NextRequest, NextResponse } from "next/server";
import { stripe, createPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const _userId = "default"; // TODO: get from session
  const origin = req.headers.get("origin") || "http://localhost:3000";

  // Get customer ID from subscription
  let customerId: string | null = null;
  try {
    const customers = await stripe.customers.list({ limit: 1 });
    if (customers.data[0]) customerId = customers.data[0].id;
  } catch { /* ignore */ }

  if (!customerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const url = await createPortalSession(customerId, `${origin}/billing`);
  if (!url) {
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
