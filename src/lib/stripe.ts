// Stripe billing integration — plans, usage tracking, plan enforcement.
//
// This module provides:
// - 4 plans (Free, Pro, Team, Enterprise) with limits
// - Usage tracking (per user, per month, per type)
// - Plan enforcement (check before processing requests)
// - Stripe Checkout + Customer Portal integration
import * as Sentry from "@sentry/nextjs";


import Stripe from "stripe";
import { logger } from "./logger";
import { getDb, isPostgresAvailable, getPrismaDb } from "./db";

// ---------- Stripe client ----------

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

// ---------- Plans ----------

export const PLANS = {
  free: {
    name: "Free",
    priceId: null,
    limits: { researchPerMonth: 10, chatPerDay: 50, tokensPerMonth: 50_000 },
    features: ["basic_research", "chat"],
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: { researchPerMonth: 100, chatPerDay: 500, tokensPerMonth: 1_000_000 },
    features: ["basic_research", "chat", "swarm", "vision", "file_generation"],
  },
  team: {
    name: "Team",
    priceId: process.env.STRIPE_TEAM_PRICE_ID || null,
    limits: { researchPerMonth: 1000, chatPerDay: Infinity, tokensPerMonth: 10_000_000 },
    features: ["basic_research", "chat", "swarm", "vision", "file_generation", "organizations"],
  },
  enterprise: {
    name: "Enterprise",
    priceId: null,
    limits: { researchPerMonth: Infinity, chatPerDay: Infinity, tokensPerMonth: Infinity },
    features: ["all"],
  },
} as const;

export type Plan = keyof typeof PLANS;

// ---------- Usage tracking ----------

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export async function getUserPlan(userId: string): Promise<Plan> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const sub = await prisma.subscription.findFirst({
          where: { userId, status: "active" },
          orderBy: { createdAt: "desc" },
        });
        if (sub && PLANS[sub.plan as Plan]) return sub.plan as Plan;
      }
    } catch (err) {
      // Non-critical: Postgres subscription lookup failed (DB unreachable,
      // schema mismatch). Fall through to SQLite — plan defaults to "free"
      // if neither store has an active sub, which is fail-safe (Free limits
      // are the most restrictive).
      Sentry.captureException(err);
      logger.warn(
        { module: "stripe", userId, err: err instanceof Error ? err.message : String(err) },
        "getUserPlan: Postgres lookup failed — falling back to SQLite"
      );
    }
  }
  // SQLite fallback
  try {
    const db = getDb();
    const row = db.prepare("SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(userId) as { plan: string } | undefined;
    if (row && PLANS[row.plan as Plan]) return row.plan as Plan;
  } catch (err) {
    // Non-critical: SQLite subscription lookup failed (DB locked, table
    // missing). Default to "free" plan — fail-safe (most restrictive).
    Sentry.captureException(err);
    logger.warn(
      { module: "stripe", userId, err: err instanceof Error ? err.message : String(err) },
      "getUserPlan: SQLite lookup failed — defaulting to free"
    );
  }
  return "free";
}

export async function checkUsageLimit(userId: string, type: "research" | "chat" | "tokens"): Promise<UsageCheck> {
  const plan = await getUserPlan(userId);
  const limits = PLANS[plan].limits;

  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  let limit: number;
  let periodType: string;

  if (type === "chat") {
    limit = limits.chatPerDay;
    periodType = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for daily
  } else if (type === "research") {
    limit = limits.researchPerMonth;
    periodType = period;
  } else {
    limit = limits.tokensPerMonth;
    periodType = period;
  }

  let count = 0;
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const record = await prisma.usageRecord.findUnique({
          where: { userId_type_period: { userId, type, period: periodType } },
        });
        count = record ? (type === "tokens" ? record.tokensUsed : record.count) : 0;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  if (count === 0) {
    try {
      const db = getDb();
      const row = db.prepare("SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = ? AND period = ?").get(userId, type, periodType) as { count: number; tokens_used: number } | undefined;
      count = row ? (type === "tokens" ? row.tokens_used : row.count) : 0;
    } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
  }

  const remaining = Math.max(0, limit - count);
  return { allowed: count < limit, remaining, limit };
}

export async function incrementUsage(userId: string, type: string, tokens = 0): Promise<void> {
  const period = type === "chat" ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 7);

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.usageRecord.upsert({
          where: { userId_type_period: { userId, type, period } },
          create: { userId, type, count: 1, tokensUsed: tokens, period },
          update: { count: { increment: 1 }, tokensUsed: { increment: tokens } },
        });
        return;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  // SQLite fallback
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO usage_records (id, user_id, type, count, tokens_used, period, created_at)
      VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
      ON CONFLICT(user_id, type, period) DO UPDATE SET count = count + 1, tokens_used = tokens_used + ?
    `).run(crypto.randomUUID(), userId, type, tokens, period, tokens);
  } catch (err) {
    logger.warn({ err, userId, type }, "Failed to increment usage");
  }
}

// ---------- Plan enforcement ----------

export async function enforcePlanLimit(
  userId: string,
  type: "research" | "chat" | "tokens"
): Promise<{ allowed: boolean; reason?: string }> {
  const check = await checkUsageLimit(userId, type);
  if (!check.allowed) {
    const plan = await getUserPlan(userId);
    return {
      allowed: false,
      reason: `Plan limit reached (${PLANS[plan].name} plan: ${check.limit} ${type}/month). Upgrade at /billing.`,
    };
  }
  return { allowed: true };
}

// ---------- Stripe Checkout ----------

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: { userId },
  });

  return session.url;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ---------- Metered billing ----------

/**
 * Report metered usage to Stripe for a metered subscription item.
 *
 * P1 feature: Stripe metered billing. Called by the usage-tracker
 * flusher (src/lib/usage-tracker.ts) every 60 seconds with the
 * aggregate quantity for each active metered subscription.
 *
 * API version compatibility: Stripe v17 deprecated
 * `subscriptionItems.createUsageRecord` in favor of the new
 * `billing.meterEvents.create` API (event-name based rather than
 * subscription-item based). The installed stripe-node v22 only types
 * the new API. We probe for the legacy method at runtime — if present
 * (e.g. older stripe-node versions, or operators who pinned the
 * legacy API), we use it (the spec's original API). Otherwise we
 * fall back to the new meter-events API, mapping the subscription
 * item id to a meter event name using the convention configured in
 * the `STRIPE_METER_EVENT_NAME` env var (default: `quaesitor_usage`).
 *
 * Failures are swallowed (logged at error level) — usage reporting
 * is best-effort. A failed report means the user might be slightly
 * under-billed for one period; the next successful flush will catch
 * up because the DB-side `usage_records` table is the source of
 * truth (we re-sum the full period each flush, not just deltas).
 *
 * @param subscriptionItemId  The Stripe subscription item id (e.g.
 *   `si_abc123`) — used by the legacy API. Ignored by the new
 *   meter-events API (which is customer/meter based).
 * @param quantity  The number of metered events to report. Must be
 *   a non-negative integer. Stripe rejects floats and negative
 *   numbers with a 400.
 * @param customerId  Optional — the Stripe customer id. Required by
 *   the new meter-events API (v17+). When omitted and the legacy API
 *   is unavailable, the report is dropped (logged at warn level).
 */
export async function reportUsage(
  subscriptionItemId: string,
  quantity: number,
  customerId?: string
): Promise<void> {
  if (!stripe) return;
  if (!subscriptionItemId || quantity <= 0) return;

  try {
    // Probe for the legacy `subscriptionItems.createUsageRecord`
    // method. The TypeScript types removed it in v17, but the
    // runtime method may still exist on older stripe-node installs
    // or operators who pinned a legacy API version. Use a typed
    // cast so tsc stays happy without `any`.
    const items = stripe.subscriptionItems as unknown as {
      createUsageRecord?: (
        id: string,
        params: {
          quantity: number;
          timestamp: number;
          action: "increment" | "set";
        },
        options?: unknown
      ) => Promise<unknown>;
    };

    if (typeof items.createUsageRecord === "function") {
      await items.createUsageRecord(subscriptionItemId, {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: "increment",
      });
      return;
    }

    // New API (stripe-node v17+): billing.meterEvents.create.
    // This is event-name + customer + value based. We map the
    // subscription item id to a meter event name via env var so
    // operators can configure the meter in Stripe once and have
    // every subscription report against it.
    if (!customerId) {
      logger.warn(
        { subscriptionItemId, quantity },
        "Stripe metered billing: legacy createUsageRecord unavailable and no customerId for new meter-events API — usage report dropped"
      );
      return;
    }

    const eventName =
      process.env.STRIPE_METER_EVENT_NAME || "quaesitor_usage";
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: customerId,
        value: String(quantity),
      },
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    // P0-10: sanitize the error before logging — Stripe API errors
    // can include the request URL with the secret key embedded.
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        subscriptionItemId,
        quantity,
      },
      "Failed to report usage to Stripe"
    );
  }
}
