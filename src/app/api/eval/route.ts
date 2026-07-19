// POST /api/eval
// Run the evaluation suite. Admin-only (rate-limited: 1 run per 10 minutes).
//
// Body: { queries?: string[] } (optional — if empty, run all eval queries)
// Response: { summary, results }
//
// This endpoint is expensive (runs real research jobs + LLM calls).
// Rate limited to 1 run per 10 minutes per IP to prevent abuse.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { runEvalSuite } from "@/lib/eval/runner";
import { EVAL_DATASET } from "@/lib/eval/dataset";
import { requireAuth } from "@/lib/auth";
import { getClientIP } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

// Simple per-IP rate limit for eval runs (1 per 10 min).
const evalRateLimit = new Map<string, number>(); // ip → last run timestamp
const EVAL_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // Rate limit check.
  // H-3: use getClientIP() instead of reading X-Forwarded-For directly.
  const ip = getClientIP(req);
  const lastRun = evalRateLimit.get(ip) || 0;
  const elapsed = Date.now() - lastRun;
  if (elapsed < EVAL_COOLDOWN_MS) {
    const retryAfter = Math.ceil((EVAL_COOLDOWN_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: `Eval rate limit: try again in ${retryAfter}s` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Parse body (optional).
  let body: { queries?: string[] } = {};
  try {
    body = await req.json();
  } catch (err) {
  Sentry.captureException(err);
// Empty body is fine — run all queries.
  
}

  // Validate query IDs if provided.
  if (body.queries && body.queries.length > 0) {
    const validIds = new Set(EVAL_DATASET.map((q) => q.id));
    const invalid = body.queries.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid query IDs: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
  }

  evalRateLimit.set(ip, Date.now());

  try {
    const result = await runEvalSuite({ queries: body.queries });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Eval failed" },
      { status: 500 }
    );
  }
}

// GET: return the dataset (metadata only, no execution).
export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  return NextResponse.json({
    queries: EVAL_DATASET.map((q) => ({
      id: q.id,
      query: q.query,
      type: q.type,
      difficulty: q.difficulty,
      hasCodingTest: !!q.codingTest,
      expectedSourcesCount: q.expectedSources?.length || 0,
      expectedKeywordsCount: q.expectedKeywords?.length || 0,
    })),
    total: EVAL_DATASET.length,
  });
}
