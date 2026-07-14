// GET    /api/sessions — list sessions (newest first).
// DELETE /api/sessions — delete all sessions.

import { listSessions, deleteAllSessions, countSessions } from "@/lib/session-store";
import { getActiveJobs } from "@/lib/research-store";

export async function GET() {
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

export async function DELETE() {
  const deleted = deleteAllSessions();
  return Response.json({ ok: true, deleted });
}
