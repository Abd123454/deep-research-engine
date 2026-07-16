// POST /api/billing/webhook — handle Stripe webhooks
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { getDb } from "@/lib/db";

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
        const userId = session.client_reference_id || session.metadata?.userId || "default";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Store subscription in DB
        try {
          const db = getDb();
          db.prepare(`
            INSERT OR REPLACE INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pro', 'active', datetime('now'), datetime('now'))
          `).run(crypto.randomUUID(), userId, customerId, subscriptionId);
          logger.info({ userId, customerId, subscriptionId }, "Subscription created via checkout");
        } catch (err) {
          logger.error({ err }, "Failed to store subscription");
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        try {
          const db = getDb();
          db.prepare(`UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
            .run(sub.status, sub.id);
          logger.info({ subscriptionId: sub.id, status: sub.status }, "Subscription updated");
        } catch { /* ignore */ }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        try {
          const db = getDb();
          db.prepare(`UPDATE subscriptions SET status = 'canceled', updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
            .run(sub.id);
          logger.info({ subscriptionId: sub.id }, "Subscription canceled");
        } catch { /* ignore */ }
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
