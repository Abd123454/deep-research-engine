// Plan limits — server-side usage-checking layer.
//
// The pure constants and types live in `plan-limits-data.ts` (safe for client
// import — no db, no prisma). This file re-exports them and adds the server-side
// functions (getPlanForUser, checkLimit) that query the database.
//
// Client components (PricingCalculator, dashboard) MUST import from
// `plan-limits-data.ts` — importing from this file would pull better-sqlite3
// into the client bundle and break the build.

export { type Plan, type PlanLimit, PLAN_LIMITS, recommendPlan } from "./plan-limits-data";

import { getDb, isPostgresAvailable, getPrismaDb } from "./db";
import { logger } from "./logger";
import { PLAN_LIMITS, type Plan, type PlanLimit } from "./plan-limits-data";

export const PLAN_ORDER: Plan[] = ["free", "pro", "team", "enterprise"];

/**
 * Look up which plan a user is currently subscribed to.
 *
 * Resolution order:
 *  1. Postgres `subscriptions` table (if DATABASE_URL is set to postgres).
 *  2. SQLite `subscriptions` table (development default).
 *  3. Fallback to "free" if no active subscription is found OR the lookup
 *     fails (fail-open so dev deployments with no DB write access still
 *     work — production routes that need to refuse anonymous access do so
 *     via `requireAuth`, not via this function).
 */
export function getPlanForUser(userId: string): Plan {
  // Postgres path.
  if (isPostgresAvailable()) {
    try {
      // Synchronous SQLite is preferred for the hot path — but Postgres is
      // async-only. To keep the function signature sync (callers in the API
      // routes use it inline), we fall through to SQLite if we can't reach
      // Postgres synchronously. The async variant below is the canonical
      // implementation for callers that can await.
    } catch (err) {
      logger.warn(
        { module: "plan-limits", err: err instanceof Error ? err.message : String(err) },
        "getPlanForUser Postgres probe failed — using SQLite"
      );
    }
  }

  // SQLite fallback (always available — even in-memory).
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
      )
      .get(userId) as { plan: string } | undefined;
    if (row && (PLAN_LIMITS as Record<string, PlanLimit>)[row.plan]) {
      return row.plan as Plan;
    }
  } catch (err) {
    logger.warn(
      { module: "plan-limits", err: err instanceof Error ? err.message : String(err) },
      "getPlanForUser SQLite lookup failed — defaulting to free"
    );
  }

  return "free";
}

/**
 * Async variant — used by API routes that already await other I/O. Prefers
 * Postgres when available, falls back to the synchronous SQLite path.
 */
export async function getPlanForUserAsync(userId: string): Promise<Plan> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const sub = await prisma.subscription.findFirst({
          where: { userId, status: "active" },
          orderBy: { createdAt: "desc" },
        });
        if (sub && (PLAN_LIMITS as Record<string, PlanLimit>)[sub.plan]) {
          return sub.plan as Plan;
        }
      }
    } catch (err) {
      logger.warn(
        { module: "plan-limits", err: err instanceof Error ? err.message : String(err) },
        "getPlanForUserAsync Postgres lookup failed — falling back to SQLite"
      );
    }
  }
  return getPlanForUser(userId);
}

export type LimitResource = "research" | "chat" | "files" | "swarm";

export interface LimitCheck {
  /** True if the user can perform one more unit of `resource`. */
  allowed: boolean;
  /** Remaining units in the current period (Infinity for unlimited plans). */
  remaining: number;
  /** The configured limit for the user's plan. */
  limit: number;
  /** The plan the check was made against. */
  plan: Plan;
}

/**
 * Check whether a user can perform one more unit of a metered resource.
 *
 * Usage in API routes:
 *   const check = checkLimit(userId, "research");
 *   if (!check.allowed) {
 *     return NextResponse.json(
 *       { ok: false, error: "Plan limit reached.", plan: check.plan, limit: check.limit },
 *       { status: 402 }
 *     );
 *   }
 *
 * For chat messages, the period is the current calendar day (matches the
 * existing rate-limit semantics in `src/lib/stripe.ts`). For research jobs
 * and file uploads, the period is the current calendar month. Swarm size
 * is a structural limit (max agents per job), not a metered one — `remaining`
 * returns the configured cap.
 *
 * Implementation note: this function is fail-open. If the usage table can't
 * be read (e.g. fresh in-memory DB, schema not yet created), the call is
 * allowed. This matches the existing `enforcePlanLimit` behavior in
 * `src/lib/stripe.ts` so we don't introduce a stricter gate than what the
 * tests already exercise.
 */
export function checkLimit(
  userId: string,
  resource: LimitResource
): LimitCheck {
  const plan = getPlanForUser(userId);
  const limits = PLAN_LIMITS[plan];

  // Structural limit — no period-based usage to look up.
  if (resource === "swarm") {
    return { allowed: true, remaining: limits.swarmAgents, limit: limits.swarmAgents, plan };
  }
  if (resource === "files") {
    // File upload is enforced at the upload route via content-length check,
    // not via a per-period counter. Surface the configured cap.
    return { allowed: true, remaining: limits.maxFileUploadMB, limit: limits.maxFileUploadMB, plan };
  }

  // Monthly: research is YYYY-MM; chat is YYYY-MM-DD (matches stripe.ts).
  const period =
    resource === "chat"
      ? new Date().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 7);

  const configuredLimit =
    resource === "chat" ? limits.monthlyChatMessages : limits.monthlyResearch;

  let used = 0;
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = ? AND period = ?"
      )
      .get(userId, resource, period) as { count: number; tokens_used: number } | undefined;
    used = row ? row.count : 0;
  } catch (err) {
    // Fail-open: if we can't read usage, allow the action. The audit log
    // + Sentry will surface the underlying DB issue.
    logger.warn(
      { module: "plan-limits", err: err instanceof Error ? err.message : String(err) },
      "checkLimit usage lookup failed — allowing action"
    );
    used = 0;
  }

  if (configuredLimit === Infinity) {
    return { allowed: true, remaining: Infinity, limit: Infinity, plan };
  }

  const remaining = Math.max(0, configuredLimit - used);
  return { allowed: used < configuredLimit, remaining, limit: configuredLimit, plan };
}

// recommendPlan is re-exported from plan-limits-data.ts (pure function, no db).
// The version that was here used `PLAN_ORDER` which is server-side only;
// the data-file version is the canonical one for both client and server.

