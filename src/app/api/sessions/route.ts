// GET    /api/sessions — list sessions (newest first).
// DELETE /api/sessions — delete all sessions.

import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { listSessions, deleteAllSessions, countSessions } from "@/lib/session-store";
import { getActiveJobs } from "@/lib/research-store";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const sessions = listSessions(50, 0);
    // Include active (in-progress) research jobs from the in-memory store.
    // These are jobs currently running — not yet persisted to SQLite.
    const activeJobs = getActiveJobs().map((j) => ({
      id: j.id,
      query: j.query,
      status: j.status,
      startedAt: j.startedAt,
      updatedAt: j.updatedAt,
      stats: {
        totalPagesRead: j.stats.totalPagesRead,
        totalPagesSucceeded: j.stats.totalPagesSucceeded,
        roundsCompleted: j.stats.roundsCompleted,
      },
    }));
    return Response.json({
      ok: true,
      sessions,
      activeJobs,
      total: countSessions(),
    });
  } catch (err) {
    // FB-3 fix: SQLite can throw (DB locked, corrupt file). Without
    // try/catch the route returned a raw 500 with a stack trace.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "sessions", err: safe }, "session list failed");
    return Response.json(
      { ok: false, error: safe || "Failed to list sessions." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const deleted = deleteAllSessions();
    return Response.json({ ok: true, deleted });
  } catch (err) {
    // FB-3 fix: wrap deleteAllSessions in try/catch for the same reason
    // as GET above — SQLite errors should not leak as raw 500s.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "sessions", err: safe }, "session delete-all failed");
    return Response.json(
      { ok: false, error: safe || "Failed to delete sessions." },
      { status: 500 }
    );
  }
}
