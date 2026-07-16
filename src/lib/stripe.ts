// Stripe billing integration — plans, usage tracking, plan enforcement.
//
// This module provides:
// - 4 plans (Free, Pro, Team, Enterprise) with limits
// - Usage tracking (per user, per month, per type)
// - Plan enforcement (check before processing requests)
// - Stripe Checkout + Customer Portal integration

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
    } catch { /* fall through */ }
  }
  // SQLite fallback
  try {
    const db = getDb();
    const row = db.prepare("SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(userId) as { plan: string } | undefined;
    if (row && PLANS[row.plan as Plan]) return row.plan as Plan;
  } catch { /* ignore */ }
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
    } catch { /* fall through */ }
  }
  if (count === 0) {
    try {
      const db = getDb();
      const row = db.prepare("SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = ? AND period = ?").get(userId, type, periodType) as { count: number; tokens_used: number } | undefined;
      count = row ? (type === "tokens" ? row.tokens_used : row.count) : 0;
    } catch { /* ignore */ }
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
    } catch { /* fall through */ }
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
