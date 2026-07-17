// POST /api/billing/webhook — handle Stripe webhooks
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/analytics";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { getDb } from "@/lib/db";
import { logSensitiveAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info({ type: event.type, id: event.id }, "Stripe webhook received");

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // SECURITY: the userId here comes from the checkout session that
        // *we* created (see /api/billing/checkout). It is populated from
        // our auth-resolved userId at checkout time. The fallback to
        // "default" only triggers if a checkout was created without our
        // client_reference_id/metadata — log a warning so that's visible.
        const userId = session.client_reference_id || session.metadata?.userId || "default";
        if (userId === "default") {
          logger.warn(
            { module: "billing-webhook", sessionId: session.id },
            "Stripe checkout.session.completed has no userId — falling back to 'default'"
          );
        }
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Read the actual plan from the Stripe price lookup_key (not hardcoded).
        // The checkout session's line items reference a price; the price has a
        // lookup_key we set when creating products (e.g. "pro", "team", "enterprise").
        let plan = "free";
        try {
          if (subscriptionId && stripe) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ["items.data.price"],
            });
            const lookupKey = sub.items.data[0]?.price?.lookup_key;
            if (lookupKey && ["free", "pro", "team", "enterprise"].includes(lookupKey)) {
              plan = lookupKey;
            } else if (session.metadata?.plan && ["free", "pro", "team", "enterprise"].includes(session.metadata.plan)) {
              plan = session.metadata.plan;
            }
          }
        } catch (err) {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Failed to read plan from Stripe subscription, falling back to metadata");
          if (session.metadata?.plan && ["free", "pro", "team", "enterprise"].includes(session.metadata.plan)) {
            plan = session.metadata.plan;
          }
        }

        // Store subscription in DB
        try {
          const db = getDb();
          db.prepare(`
            INSERT OR REPLACE INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
          `).run(crypto.randomUUID(), userId, customerId, subscriptionId, plan);
          logger.info({ userId, customerId, subscriptionId, plan }, "Subscription created via checkout");
        } catch (err) {
          logger.error({ err }, "Failed to store subscription");
        }
        trackEvent(userId, "plan_upgraded", { plan, customerId });
        // SENSITIVE ACTION: subscription activated. Logged against the
        // userId embedded in the checkout session (set by /billing/checkout
        // from getUserId(req) at creation time).
        logSensitiveAction("billing.subscribe", userId, req, {
          phase: "completed",
          plan,
          customerId,
          subscriptionId,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        try {
          const db = getDb();
          db.prepare(`UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
            .run(sub.status, sub.id);
          logger.info({ subscriptionId: sub.id, status: sub.status }, "Subscription updated");
        } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        let canceledUserId = "default";
        try {
          const db = getDb();
          // Look up the userId from our local subscriptions table BEFORE
          // we mark it canceled (so we can attribute the audit log).
          const row = db
            .prepare("SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?")
            .get(sub.id) as { user_id?: string } | undefined;
          if (row?.user_id) canceledUserId = row.user_id;
          db.prepare(`UPDATE subscriptions SET status = 'canceled', updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
            .run(sub.id);
          logger.info({ subscriptionId: sub.id }, "Subscription canceled");
        } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
        // SENSITIVE ACTION: subscription canceled (by user via portal,
        // or by Stripe for non-payment).
        logSensitiveAction("billing.cancel", canceledUserId, req, {
          phase: "completed",
          subscriptionId: sub.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        logger.warn({ invoiceId: invoice.id, customerId: invoice.customer }, "Payment failed");
        break;
      }

      default:
        logger.info({ type: event.type }, "Unhandled Stripe webhook event");
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Error processing Stripe webhook");
  }

  return NextResponse.json({ received: true });
}
