// GET /api/dashboard/stats — returns usage + plan + limits
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan, checkUsageLimit, PLANS } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const plan = await getUserPlan(userId);
  const [research, chat, tokens] = await Promise.all([
    checkUsageLimit(userId, "research"),
    checkUsageLimit(userId, "chat"),
    checkUsageLimit(userId, "tokens"),
  ]);

  // Get recent activity
  let recentActivity: Array<{ id: string; query: string; status: string; createdAt: string }> = [];
  try {
    const db = getDb();
    const rows = db.prepare("SELECT id, query, status, created_at FROM research_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(userId) as Array<{ id: string; query: string; status: string; created_at: string }>;
    recentActivity = rows.map((r) => ({ id: r.id, query: r.query, status: r.status, createdAt: r.created_at }));
  } catch { /* ignore */ }

  return NextResponse.json({
    plan,
    planName: PLANS[plan].name,
    usage: { research, chat, tokens },
    features: PLANS[plan].features,
    recentActivity,
  });
}
