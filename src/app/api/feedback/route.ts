// POST /api/feedback — store user feedback (thumbs up/down + free text).
// GET  /api/feedback — admin-only feedback stats (counts + recent items).
//
// Strategic #9 — powers the floating FeedbackWidget at the bottom-left of
// every page. The widget submits a JSON body with:
//   - `rating`: "up" | "down"
//   - `comment`: optional free-text feedback (max 5k chars)
//   - `context`: optional object with the page/route/conversationId the
//     feedback was given from (helps triage)
//
// Storage: lazily-created `feedback` table in SQLite. Postgres deployments
// should add a Prisma model mirroring this schema.
//
// Auth: POST requires `requireAuth` (users must be signed in to leave
// feedback — anonymous feedback is rejected to prevent spam). GET requires
// `requireAuth` + `requireAdminAccess` (admin-only stats).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth, requireAdminAccess } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEEDBACK_TABLE = "feedback";
const MAX_COMMENT_CHARS = 5000;

const PostSchema = z.object({
  rating: z.enum(["up", "down"]),
  comment: z.string().max(MAX_COMMENT_CHARS).optional().nullable(),
  context: z
    .object({
      route: z.string().max(500).optional(),
      conversationId: z.string().max(200).optional(),
      messageId: z.string().max(200).optional(),
    })
    .optional()
    .nullable(),
});

function ensureFeedbackTable(): void {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${FEEDBACK_TABLE} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        rating TEXT NOT NULL,
        comment TEXT,
        context TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_feedback_created ON ${FEEDBACK_TABLE}(created_at DESC)`
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_feedback_user ON ${FEEDBACK_TABLE}(user_id)`
    );
  } catch (err) {
    logger.warn(
      { module: "feedback", err: err instanceof Error ? err.message : String(err) },
      "ensureFeedbackTable failed"
    );
  }
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let parsed;
  try {
    parsed = PostSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: firstErr
          ? `${firstErr.path.join(".") || "input"}: ${firstErr.message}`
          : "Invalid request body.",
      },
      { status: 400 }
    );
  }

  ensureFeedbackTable();
  try {
    const db = getDb();
    const id = crypto.randomUUID();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;
    db.prepare(
      `INSERT INTO ${FEEDBACK_TABLE} (id, user_id, rating, comment, context, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id,
      userId,
      parsed.data.rating,
      parsed.data.comment ?? null,
      parsed.data.context ? JSON.stringify(parsed.data.context) : null,
      ip,
      userAgent
    );
    // Audit-log the feedback submission (resource: admin — feedback is
    // reviewed by ops/admins, not the user themselves).
    logSensitiveAction("admin.access", userId, req, {
      action: "feedback.submit",
      rating: parsed.data.rating,
      hasComment: !!parsed.data.comment,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    logger.error(
      { module: "feedback", err: err instanceof Error ? err.message : String(err) },
      "Failed to store feedback"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to store feedback." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Admin-only: IP allowlist + auth.
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  logSensitiveAction("admin.access", userId, req, { route: "feedback-stats" });

  ensureFeedbackTable();
  try {
    const db = getDb();
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM ${FEEDBACK_TABLE}`)
      .get() as { count: number } | undefined;
    const upRow = db
      .prepare(`SELECT COUNT(*) as count FROM ${FEEDBACK_TABLE} WHERE rating = 'up'`)
      .get() as { count: number } | undefined;
    const downRow = db
      .prepare(`SELECT COUNT(*) as count FROM ${FEEDBACK_TABLE} WHERE rating = 'down'`)
      .get() as { count: number } | undefined;
    const withCommentRow = db
      .prepare(`SELECT COUNT(*) as count FROM ${FEEDBACK_TABLE} WHERE comment IS NOT NULL AND comment != ''`)
      .get() as { count: number } | undefined;
    const recent = db
      .prepare(
        `SELECT id, user_id, rating, comment, context, created_at FROM ${FEEDBACK_TABLE} ORDER BY created_at DESC LIMIT 50`
      )
      .all() as Array<{
        id: string;
        user_id: string;
        rating: string;
        comment: string | null;
        context: string | null;
        created_at: string;
      }>;

    const total = totalRow?.count ?? 0;
    const up = upRow?.count ?? 0;
    const down = downRow?.count ?? 0;

    return NextResponse.json({
      ok: true,
      totals: {
        total,
        up,
        down,
        withComment: withCommentRow?.count ?? 0,
        upRate: total > 0 ? Math.round((up / total) * 1000) / 1000 : 0,
      },
      recent: recent.map((r) => ({
        id: r.id,
        userId: r.user_id,
        rating: r.rating,
        comment: r.comment,
        context: r.context ? safeParse(r.context) : null,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    logger.error(
      { module: "feedback", err: err instanceof Error ? err.message : String(err) },
      "Failed to read feedback stats"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read feedback stats." },
      { status: 500 }
    );
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
