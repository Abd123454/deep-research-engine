// GET    /api/sessions — list sessions (newest first).
// DELETE /api/sessions — delete all sessions.

import { NextRequest } from "next/server";
import { listSessions, deleteAllSessions, countSessions } from "@/lib/session-store";
import { getActiveJobs } from "@/lib/research-store";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

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
}

export async function DELETE(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const deleted = deleteAllSessions();
  return Response.json({ ok: true, deleted });
}
