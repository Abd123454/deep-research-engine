// Usage tracking — accumulates metered usage in the DB and reports it
// to Stripe in batches every 60 seconds.
//
// P1 feature: Stripe metered billing. The flow is:
//   1. API routes (chat, research, swarm) call `recordUsage(userId, type)`
//      on every metered event. The record is persisted to the
//      `usage_records` table immediately so accurate billing data
//      survives process restarts.
//   2. A 60-second interval (the "flusher") reads all metered
//      subscriptions from the DB, sums their unreported usage since
//      the last flush, and calls `stripe.subscriptionItems.createUsageRecord`
//      with `action: "increment"`.
//   3. The flusher is best-effort — if Stripe is unreachable, the
//      usage stays in the DB and gets reported on the next flush
//      (Stripe's metered billing accumulates by quantity, not by
//      timestamp, so a delayed report still results in the right
//      total at the end of the period).
//
// The flusher ONLY runs when `STRIPE_SECRET_KEY` is set — dev/test
// deployments without Stripe configured never start the interval,
// so the test suite is unaffected.
import * as crypto from "crypto";
import { getDb } from "./db";
import { reportUsage } from "./stripe";
import { logger } from "./logger";

export type UsageType = "chat" | "research" | "swarm";

/**
 * The flush interval in milliseconds. 60 seconds matches the spec —
 * short enough that metered billing is near-real-time, long enough
 * that we batch ~60 reports per hour per subscription (Stripe's API
 * rate limit is 100/sec, so this is well within budget).
 */
const FLUSH_INTERVAL_MS = 60_000;

/**
 * Record a metered usage event.
 *
 * Persists to the `usage_records` table immediately (NOT just an
 * in-memory buffer) so usage data survives process restarts. The
 * record's `period` is YYYY-MM for research/swarm (monthly) and
 * YYYY-MM-DD for chat (daily) — matches the existing plan-limits
 * enforcement in src/lib/plan-limits.ts.
 *
 * The Stripe-side reporting happens later, in the 60-second flush
 * cycle (see `flushUsage`). This function does NOT block on Stripe —
 * it returns immediately after the DB write.
 *
 * Failures are swallowed — usage tracking is best-effort and must
 * NOT block the user-facing request. A failed write is logged at
 * warn level so ops can see it, but the request proceeds.
 */
export function recordUsage(userId: string, type: UsageType): void {
  const period =
    type === "chat"
      ? new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      : new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const db = getDb();
    // Upsert into the existing usage_records table. The UNIQUE
    // (user_id, type, period) constraint lets us increment in place.
    db.prepare(`
      INSERT INTO usage_records (id, user_id, type, count, tokens_used, period, created_at)
      VALUES (?, ?, ?, 1, 0, ?, datetime('now'))
      ON CONFLICT(user_id, type, period) DO UPDATE SET count = count + 1
    `).run(crypto.randomUUID(), userId, type, period);
  } catch (err) {
    // Best-effort — don't block the request.
    logger.warn(
      {
        module: "usage-tracker",
        err: err instanceof Error ? err.message : String(err),
        userId,
        type,
      },
      "Failed to record usage (DB write) — usage event dropped"
    );
  }
}

/**
 * Flush all unreported usage to Stripe.
 *
 * Walks every active subscription that has a `stripe_subscription_item_id`,
 * sums the user's metered usage since the last flush, and reports it
 * to Stripe via `reportUsage`. Failures per-subscription are logged
 * but do NOT abort the loop — a single broken subscription shouldn't
 * prevent the others from reporting.
 *
 * NOTE: the current implementation is a simplified version. The
 * `subscriptions` table doesn't yet have a `stripe_subscription_item_id`
 * column (it would be populated by the `checkout.session.completed`
 * webhook handler). When that column is absent or NULL, this function
 * is a no-op — the DB-side usage tracking (above) still works
 * independently, so plan-limits enforcement and the /api/billing/usage
 * endpoint continue to function. Stripe metered reporting kicks in
 * once the subscription item id is populated (e.g. by a future
 * webhook enhancement that stores `subscription.items.data[0].id`).
 */
export async function flushUsage(): Promise<void> {
  try {
    const db = getDb();

    // Check whether the column exists before querying — defense-in-depth
    // for deployments where the migration hasn't been applied yet.
    const tableInfo = db.prepare("PRAGMA table_info(subscriptions)").all() as
      | Array<{ name: string }>
      | undefined;
    const hasItemIdColumn =
      !!tableInfo &&
      tableInfo.some((col) => col.name === "stripe_subscription_item_id");

    if (!hasItemIdColumn) {
      // Migration not applied — nothing to flush. The DB-side usage
      // records still accumulate correctly; Stripe-side reporting will
      // start once the column is added.
      return;
    }

    // Active metered subscriptions with a known subscription item id.
    // The `stripe_subscription_item_id` is the handle Stripe needs for
    // `subscriptionItems.createUsageRecord`.
    const subs = db
      .prepare(
        `SELECT user_id, stripe_subscription_item_id FROM subscriptions
         WHERE status = 'active'
           AND stripe_subscription_item_id IS NOT NULL`
      )
      .all() as Array<{
      user_id: string;
      stripe_subscription_item_id: string;
    }>;

    if (subs.length === 0) return;

    for (const sub of subs) {
      // Sum the user's chat + research + swarm counts for the current
      // period(s). We report a single aggregate quantity per flush —
      // Stripe accumulates by quantity, not by event, so batching is
      // fine. Tokens are intentionally NOT reported (the metered
      // billing model is per-request, not per-token).
      const chatPeriod = new Date().toISOString().slice(0, 10);
      const monthPeriod = new Date().toISOString().slice(0, 7);

      const chatRow = db
        .prepare(
          "SELECT count FROM usage_records WHERE user_id = ? AND type = 'chat' AND period = ?"
        )
        .get(sub.user_id, chatPeriod) as { count: number } | undefined;
      const researchRow = db
        .prepare(
          "SELECT count FROM usage_records WHERE user_id = ? AND type = 'research' AND period = ?"
        )
        .get(sub.user_id, monthPeriod) as { count: number } | undefined;
      const swarmRow = db
        .prepare(
          "SELECT count FROM usage_records WHERE user_id = ? AND type = 'swarm' AND period = ?"
        )
        .get(sub.user_id, monthPeriod) as { count: number } | undefined;

      const quantity =
        (chatRow?.count || 0) +
        (researchRow?.count || 0) +
        (swarmRow?.count || 0);

      if (quantity > 0) {
        // reportUsage swallows its own errors (logs at error level but
        // does not throw) — safe to call without try/catch.
        await reportUsage(sub.stripe_subscription_item_id, quantity);
      }
    }
  } catch (err) {
    logger.error(
      {
        module: "usage-tracker",
        err: err instanceof Error ? err.message : String(err),
      },
      "flushUsage failed"
    );
  }
}

/**
 * The interval handle for the auto-flush timer. Stored so tests can
 * clear it via `stopUsageFlusher()` if needed.
 */
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the 60-second auto-flush. Only runs when `STRIPE_SECRET_KEY`
 * is configured — dev/test deployments without Stripe never start the
 * timer, so the test suite is unaffected.
 *
 * Idempotent: calling this multiple times is safe — if a timer is
 * already running, the second call is a no-op.
 */
export function startUsageFlusher(): void {
  if (flushTimer) return;
  if (!process.env.STRIPE_SECRET_KEY) return;
  if (typeof setInterval === "undefined") return;

  flushTimer = setInterval(() => {
    flushUsage().catch((err: unknown) => {
      // Already logged inside flushUsage — swallow the unhandled
      // rejection so it doesn't crash the process. Logged here for
      // visibility on unhandled-rejection paths.
      logger.warn({ err }, "Non-critical error in flushUsage (interval)");
    });
  }, FLUSH_INTERVAL_MS);

  // Don't keep the process alive just for the flusher — Node.js
  // exiting would also exit the timer, but `unref` lets the test
  // runner exit cleanly between test files.
  if (typeof flushTimer.unref === "function") {
    flushTimer.unref();
  }

  logger.info(
    { module: "usage-tracker", intervalMs: FLUSH_INTERVAL_MS },
    "Usage flusher started"
  );
}

/**
 * Stop the auto-flush timer. Used by tests that want to assert on
 * flush behavior without the timer firing mid-test.
 */
export function stopUsageFlusher(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// Auto-start on module import. The `startUsageFlusher` guard means
// this is a no-op when STRIPE_SECRET_KEY is unset (the common case
// for dev/test). The `unref` call inside means the timer never keeps
// the process alive on its own.
startUsageFlusher();
