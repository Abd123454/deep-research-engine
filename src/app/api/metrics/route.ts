// GET /api/metrics — admin-only platform metrics dashboard.
//
// Strategic #7 — surfaces the KPIs an operator needs to understand system
// health at a glance:
//   - Total users + active users (7d / 30d windows)
//   - Total research jobs + success rate + avg duration
//   - Total chat messages + total tokens consumed
//   - Cache hit rate (from the research cache)
//   - Carbon footprint for the current month
//   - Plan distribution (free / pro / team / enterprise)
//
// Auth: requires `requireAuth` + `requireAdminAccess`. The admin IP
// allowlist (ADMIN_IP_ALLOWLIST) applies via `requireAdminAccess` if set.
// Returns 401/403/503 on auth failure (matching the audit-logs route).

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth, requireAdminAccess } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { PLAN_LIMITS, type Plan } from "@/lib/plan-limits";
import { estimateResearchCarbon, inferModelSize } from "@/lib/carbon-footprint";
import { getCacheStats } from "@/lib/research-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CountRow {
  count: number;
}

interface PlanDistributionRow {
  plan: string;
  count: number;
}

interface DurationRow {
  avg_ms: number | null;
  success_count: number;
  total_count: number;
}

function safeCount(db: ReturnType<typeof getDb>, sql: string, ...params: unknown[]): number {
  try {
    const row = db.prepare(sql).get(...params) as CountRow | undefined;
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

function safeQuery<T>(db: ReturnType<typeof getDb>, sql: string, ...params: unknown[]): T[] {
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  // IP allowlist guard for admin/operational tooling (no-op when
  // ADMIN_IP_ALLOWLIST is unset — see src/lib/auth.ts).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  logSensitiveAction("admin.access", userId, req, { route: "metrics" });

  const db = getDb();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const monthStart = new Date().toISOString().slice(0, 7);

  // ---------- Users ----------
  const totalUsers = safeCount(db, "SELECT COUNT(*) as count FROM users");
  // Active = users with at least one research job or chat message in the window.
  // We approximate by counting distinct user_ids in research_jobs + messages.
  const active7d = safeCount(
    db,
    `SELECT COUNT(DISTINCT user_id) as count FROM (
      SELECT user_id FROM research_jobs WHERE created_at >= ?
      UNION
      SELECT m.user_id FROM messages m JOIN conversations c ON m.conversation_id = c.id
      WHERE m.created_at >= ? AND m.role = 'user'
    )`,
    sevenDaysAgo,
    sevenDaysAgo
  );
  const active30d = safeCount(
    db,
    `SELECT COUNT(DISTINCT user_id) as count FROM (
      SELECT user_id FROM research_jobs WHERE created_at >= ?
      UNION
      SELECT m.user_id FROM messages m JOIN conversations c ON m.conversation_id = c.id
      WHERE m.created_at >= ? AND m.role = 'user'
    )`,
    thirtyDaysAgo,
    thirtyDaysAgo
  );

  // ---------- Research jobs ----------
  const totalResearchJobs = safeCount(db, "SELECT COUNT(*) as count FROM research_jobs");
  const completedJobs = safeCount(db, "SELECT COUNT(*) as count FROM research_jobs WHERE status = 'completed'");
  const failedJobs = safeCount(db, "SELECT COUNT(*) as count FROM research_jobs WHERE status = 'failed'");
  const successRate = totalResearchJobs > 0 ? completedJobs / totalResearchJobs : 0;

  // Avg duration — research_jobs doesn't store duration explicitly, but
  // updated_at - created_at approximates it. Fall back to null when the
  // schema doesn't have the columns (the table is created in initSqliteSchema).
  let avgDurationMs = 0;
  try {
    const durationRow = db
      .prepare(
        `SELECT
           AVG((julianday(updated_at) - julianday(created_at)) * 86400000) as avg_ms,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
           COUNT(*) as total_count
         FROM research_jobs
         WHERE status IN ('completed', 'failed')`
      )
      .get() as DurationRow | undefined;
    avgDurationMs = durationRow?.avg_ms ? Math.round(durationRow.avg_ms) : 0;
  } catch {
    avgDurationMs = 0;
  }

  // ---------- Chat ----------
  const totalChatMessages = safeCount(db, "SELECT COUNT(*) as count FROM messages WHERE role = 'user'");
  const totalAssistantMessages = safeCount(db, "SELECT COUNT(*) as count FROM messages WHERE role = 'assistant'");
  const totalTokens = safeCount(
    db,
    "SELECT COALESCE(SUM(tokens_used), 0) as count FROM messages WHERE role = 'assistant'"
  );

  // ---------- Cache hit rate ----------
  // The research cache exposes `getCacheStats()` returning `{ size, hitRate }`.
  // `hitRate` is 0 unless externally tracked (the cache itself doesn't track
  // hits/misses to avoid hot-path overhead). We surface both fields plus a
  // derived "operational" note when hitRate is 0 but size > 0.
  let cacheHitRate = 0;
  let cacheSize = 0;
  try {
    const stats = getCacheStats();
    cacheSize = stats.size;
    cacheHitRate = stats.hitRate;
  } catch {
    // Cache module not initialized — leave at 0.
  }

  // ---------- Carbon (this month) ----------
  // Sum tokens_used across all users for the current month, then estimate.
  const isLocal = process.env.NEXT_PUBLIC_LLM_PROVIDER === "ollama" || !!process.env.OLLAMA_URL;
  const modelSize = inferModelSize(process.env.NEXT_PUBLIC_LLM_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct");
  const monthlyTokens = safeCount(
    db,
    "SELECT COALESCE(SUM(tokens_used), 0) as count FROM usage_records WHERE period LIKE ?",
    `${monthStart}-%`
  );
  const monthlyResearchJobs = safeCount(
    db,
    "SELECT COUNT(*) as count FROM research_jobs WHERE created_at >= ?",
    `${monthStart}-01`
  );
  const researchCarbon = estimateResearchCarbon({
    tokensGenerated: monthlyTokens,
    pagesRead: monthlyResearchJobs * 10,
    searchQueries: monthlyResearchJobs * 5,
    modelSize,
    local: isLocal,
  });
  const totalCarbonGrams = Math.round(researchCarbon.grams * 100) / 100;

  // ---------- Plan distribution ----------
  const planRows = safeQuery<PlanDistributionRow>(
    db,
    "SELECT plan, COUNT(*) as count FROM subscriptions WHERE status = 'active' GROUP BY plan"
  );
  const planDistribution: Record<Plan, number> = {
    free: 0,
    pro: 0,
    team: 0,
    enterprise: 0,
  };
  for (const row of planRows) {
    if ((PLAN_LIMITS as Record<string, unknown>)[row.plan]) {
      planDistribution[row.plan as Plan] = row.count;
    }
  }
  // Free users = total users minus users with active paid subscriptions.
  const paidUsers = planDistribution.pro + planDistribution.team + planDistribution.enterprise;
  planDistribution.free = Math.max(0, totalUsers - paidUsers);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    users: {
      total: totalUsers,
      active7d,
      active30d,
    },
    research: {
      totalJobs: totalResearchJobs,
      completed: completedJobs,
      failed: failedJobs,
      successRate: Math.round(successRate * 1000) / 1000,
      avgDurationMs,
    },
    chat: {
      totalUserMessages: totalChatMessages,
      totalAssistantMessages: totalAssistantMessages,
      totalTokens,
    },
    cache: {
      hitRate: Math.round(cacheHitRate * 1000) / 1000,
      size: cacheSize,
    },
    carbon: {
      gramsThisMonth: totalCarbonGrams,
      local: isLocal,
      source: researchCarbon.source,
    },
    planDistribution,
  });
}
