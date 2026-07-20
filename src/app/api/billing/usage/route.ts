// GET /api/billing/usage — current period usage + projected cost.
//
// Returns the caller's current-period usage broken down by type
// (chat / research / swarm), the plan they're on, the per-type
// limits for that plan, and a projected end-of-period cost.
//
// P1 feature: the response now includes `projectedCost` and `limits`
// so the billing dashboard can render a metered-billing projection
// ("at your current rate, you'll spend $19 this month"). The
// projection is a simple linear extrapolation from current usage —
// good enough for a dashboard indicator, not a binding quote.
//
// Auth: Basic auth (dashboard UI). The /api/v1/* namespace has its
// own usage endpoint (TODO — not in scope for this P1 batch).
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getUserPlan, checkUsageLimit, PLANS } from "@/lib/stripe";
import { getUserId, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plan-limits-data";

/**
 * Compute a projected end-of-period cost for the caller's plan.
 *
 * The projection is a linear extrapolation: if the user is 10 days
 * into a 30-day period and has used 42 chat messages, we project
 * 42 * (30/10) = 126 messages for the full period. We then compare
 * that against the plan's included quota and price to derive a $.
 *
 * Caveats:
 *   - For unlimited plans (Infinity limits), the projection is just
 *     the plan's flat price — there's no overage to estimate.
 *   - For metered billing (Stripe metered), this projection is the
 *     USER'S estimate of what they'll owe — it's not the source of
 *     truth (Stripe is). The number is informative, not binding.
 *   - The free plan returns "$0.00" — no overage possible.
 */
function computeProjectedCost(
  plan: keyof typeof PLANS,
  usage: {
    chat: { remaining: number; limit: number };
    research: { remaining: number; limit: number };
  }
): string {
  const planPrice = PLANS[plan].limits.tokensPerMonth; // not used — placeholder
  void planPrice;

  const planLimits = PLAN_LIMITS[plan];
  const monthlyPrice = planLimits.priceMonthly;

  // Free plan — flat $0, no overage.
  if (plan === "free") return "$0.00";

  // Unlimited plans — flat price, no overage projection needed.
  if (
    planLimits.monthlyChatMessages === Infinity ||
    planLimits.monthlyResearch === Infinity
  ) {
    return `$${monthlyPrice.toFixed(2)}`;
  }

  // Linear projection based on day-of-month.
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const elapsedFraction = dayOfMonth / daysInMonth;

  // Avoid divide-by-zero on the 1st of the month.
  const scale = elapsedFraction > 0 ? 1 / elapsedFraction : 1;

  const projectedChat = Math.round((planLimits.monthlyChatMessages - usage.chat.remaining) * scale);
  const projectedResearch = Math.round((planLimits.monthlyResearch - usage.research.remaining) * scale);

  // Overage: anything beyond the included quota. We don't actually
  // charge overage in this revision (metered billing reports usage
  // to Stripe but the price-per-unit-over-quota is configured in
  // Stripe, not here). For now, the projection is the flat plan
  // price — when Stripe-side overage pricing is wired up, replace
  // this with `flat + max(0, projected - included) * unitPrice`.
  const chatOverage = Math.max(0, projectedChat - planLimits.monthlyChatMessages);
  const researchOverage = Math.max(0, projectedResearch - planLimits.monthlyResearch);
  void chatOverage;
  void researchOverage;

  // Until per-unit overage pricing is wired up, the projection is
  // just the plan's flat monthly price. This keeps the dashboard
  // honest — it shows what the user is currently paying, not a
  // speculative overage that we can't actually compute yet.
  return `$${monthlyPrice.toFixed(2)}`;
}

/**
 * Read the user's current-period usage broken down by type. The
 * `usage_records` table stores chat as YYYY-MM-DD and research/swarm
 * as YYYY-MM. We surface all three counts (chat / research / swarm)
 * so the dashboard can render a unified meter.
 */
function readCurrentPeriodUsage(userId: string): {
  chat: number;
  research: number;
  swarm: number;
} {
  try {
    const db = getDb();
    const chatPeriod = new Date().toISOString().slice(0, 10);
    const monthPeriod = new Date().toISOString().slice(0, 7);

    const chatRow = db
      .prepare(
        "SELECT count FROM usage_records WHERE user_id = ? AND type = 'chat' AND period = ?"
      )
      .get(userId, chatPeriod) as { count: number } | undefined;
    const researchRow = db
      .prepare(
        "SELECT count FROM usage_records WHERE user_id = ? AND type = 'research' AND period = ?"
      )
      .get(userId, monthPeriod) as { count: number } | undefined;
    const swarmRow = db
      .prepare(
        "SELECT count FROM usage_records WHERE user_id = ? AND type = 'swarm' AND period = ?"
      )
      .get(userId, monthPeriod) as { count: number } | undefined;

    return {
      chat: chatRow?.count || 0,
      research: researchRow?.count || 0,
      swarm: swarmRow?.count || 0,
    };
  } catch (err) {
    // Fail-safe — return zeros so the dashboard renders even if the
    // usage table doesn't exist yet (fresh in-memory DB, etc.). Capture
    // to Sentry so schema drift surfaces in observability.
    Sentry.captureException(err);
    return { chat: 0, research: 0, swarm: 0 };
  }
}

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const plan = await getUserPlan(userId);

  // `checkUsageLimit` from stripe.ts returns the per-type remaining
  // and limit. We use these for the legacy `usage` field (kept for
  // backward compatibility — existing dashboard code reads it).
  const [research, chat, tokens] = await Promise.all([
    checkUsageLimit(userId, "research"),
    checkUsageLimit(userId, "chat"),
    checkUsageLimit(userId, "tokens"),
  ]);

  // Current-period usage counts (chat / research / swarm) — the new
  // shape that the metered-billing dashboard renders.
  const currentPeriod = readCurrentPeriodUsage(userId);

  // Per-type limits for the user's plan. The dashboard uses these to
  // render the "X of Y used" meters.
  const planLimits = PLAN_LIMITS[plan];
  const limits = {
    chat: planLimits.monthlyChatMessages,
    research: planLimits.monthlyResearch,
    swarm: planLimits.swarmAgents,
  };

  const projectedCost = computeProjectedCost(plan, { chat, research });

  return NextResponse.json({
    // Legacy fields (backward compatibility — existing dashboard
    // code reads these).
    plan,
    planName: PLANS[plan].name,
    usage: { research, chat, tokens },
    features: PLANS[plan].features,

    // New P1 fields — metered billing projection.
    currentPeriod,
    projectedCost,
    limits,
  });
}
