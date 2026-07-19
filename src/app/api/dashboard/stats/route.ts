// GET /api/dashboard/stats — returns usage + plan + limits + carbon estimate.
//
// Commercial #3 — extended to also return:
//   - `usageThisMonth`: aggregated counts of research jobs + chat messages
//     + total tokens consumed in the current calendar month.
//   - `carbon`: estimated CO₂ for the month (from the carbon-footprint lib),
//     derived from tokensUsed + an estimated pages-read/search-queries count
//     based on the research-job count (we don't yet persist per-job carbon
//     totals, so this is a coarse estimate; see notes in the carbon lib).
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan, checkUsageLimit, PLANS } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { estimateChatCarbon, estimateResearchCarbon, inferModelSize } from "@/lib/carbon-footprint";

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
  let researchCountThisMonth = 0;
  let chatCountThisMonth = 0;
  let tokensUsedThisMonth = 0;
  try {
    const db = getDb();
    const rows = db.prepare("SELECT id, query, status, created_at FROM research_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(userId) as Array<{ id: string; query: string; status: string; created_at: string }>;
    recentActivity = rows.map((r) => ({ id: r.id, query: r.query, status: r.status, createdAt: r.created_at }));

    // ---------- Usage this month (Commercial #3) ----------
    // Aggregate from the `usage_records` table for the current YYYY-MM period.
    const month = new Date().toISOString().slice(0, 7);
    const researchRow = db
      .prepare("SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = 'research' AND period = ?")
      .get(userId, month) as { count: number; tokens_used: number } | undefined;
    const chatRow = db
      .prepare("SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = 'chat' AND period LIKE ?")
      .get(userId, `${month}-%`) as { count: number; tokens_used: number } | undefined;
    const tokenRow = db
      .prepare("SELECT count, tokens_used FROM usage_records WHERE user_id = ? AND type = 'tokens' AND period = ?")
      .get(userId, month) as { count: number; tokens_used: number } | undefined;

    researchCountThisMonth = researchRow?.count ?? 0;
    chatCountThisMonth = chatRow?.count ?? 0;
    tokensUsedThisMonth = (researchRow?.tokens_used ?? 0) + (chatRow?.tokens_used ?? 0) + (tokenRow?.tokens_used ?? 0);
  // eslint-disable-next-line no-empty
  } catch { /* ignore — stats are best-effort; missing tables return 0s */ }

  // ---------- Carbon estimate for the month (Commercial #3) ----------
  // Coarse estimate: assume each research job read ~10 pages + issued ~5
  // search queries. Chat is one LLM call per message. Model size is
  // inferred from the configured LLM provider's smart model name. When
  // Ollama is the provider, mark as local (0g remote CO₂ for LLM).
  const isLocal = process.env.NEXT_PUBLIC_LLM_PROVIDER === "ollama" || !!process.env.OLLAMA_URL;
  const modelSize = inferModelSize(process.env.NEXT_PUBLIC_LLM_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct");
  const researchCarbon = estimateResearchCarbon({
    tokensGenerated: Math.max(0, tokensUsedThisMonth - chatCountThisMonth * 500),
    pagesRead: researchCountThisMonth * 10,
    searchQueries: researchCountThisMonth * 5,
    modelSize,
    local: isLocal,
  });
  const chatCarbon = estimateChatCarbon(chatCountThisMonth * 500, modelSize, isLocal);
  const totalGrams = Math.round((researchCarbon.grams + chatCarbon.grams) * 100) / 100;
  const carbon = {
    grams: totalGrams,
    source: isLocal
      ? "Local inference (Ollama) — 0g remote LLM CO₂. Network + page-reading only."
      : "Estimated from public LLM energy data (2024). Coarse — per-job carbon tracking is on the roadmap.",
    local: isLocal,
  };

  return NextResponse.json({
    plan,
    planName: PLANS[plan].name,
    usage: { research, chat, tokens },
    usageThisMonth: {
      researchCount: researchCountThisMonth,
      chatCount: chatCountThisMonth,
      tokensUsed: tokensUsedThisMonth,
    },
    carbon,
    features: PLANS[plan].features,
    recentActivity,
  });
}
