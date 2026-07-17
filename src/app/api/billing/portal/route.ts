// POST /api/billing/portal — create Customer Portal session
//
// SECURITY FIX (was: `customers.list({limit:1})` returned ANY customer's
// portal — user A could see user B's billing). Now:
//   1. Resolve the current user via `getUserId(req)` (AUTH_USERNAME or "default").
//   2. Look up the customer ID for THIS user in our local subscriptions table.
//   3. If not found locally, fall back to a Stripe lookup filtered by the
//      user's email (which we treat as the AUTH_USERNAME) — never an unfiltered
//      `list({limit:1})`.
//   4. If still not found, 404.
import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { stripe, createPortalSession } from "@/lib/stripe";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logSensitiveAction } from "@/lib/audit";

/** Look up the Stripe customer ID stored against `userId` in our DB. */
async function findLocalCustomerId(userId: string): Promise<string | null> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const sub = await prisma.subscription.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        if (sub?.stripeCustomerId) return sub.stripeCustomerId;
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(userId) as { stripe_customer_id: string | null } | undefined;
    return row?.stripe_customer_id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  // SENSITIVE ACTION: portal access lets the user cancel/upgrade billing
  // — log every attempt. (Resource: billing.)
  logSensitiveAction("billing.portal_access", userId, req, { phase: "initiated" });
  const origin = req.headers.get("origin") || "http://localhost:3000";

  // 1. Resolve customer ID for THIS user from our DB.
  let customerId: string | null = await findLocalCustomerId(userId);

  // 2. Fall back to a user-scoped Stripe lookup. NEVER use unfiltered
  //    `customers.list({limit:1})` — that returns ANY customer.
  if (!customerId) {
    try {
      // We treat AUTH_USERNAME (or "default") as the customer email for
      // the lookup. Stripe customers are created with this email at
      // checkout time, so the match is exact.
      const customers = await stripe.customers.list({
        email: userId,
        limit: 1,
      });
      if (customers.data[0]) customerId = customers.data[0].id;
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  if (!customerId) {
    logger.info(
      { module: "billing-portal", userId },
      "No subscription found for user"
    );
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const url = await createPortalSession(customerId, `${origin}/billing`);
  if (!url) {
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }

  // SENSITIVE ACTION: portal session successfully created — user can
  // now manage their subscription in Stripe's hosted UI.
  logSensitiveAction("billing.portal_access", userId, req, {
    phase: "session_created",
    customerId,
  });

  return NextResponse.json({ url });
}
