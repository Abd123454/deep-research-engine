// GET    /api/sessions — list sessions (newest first).
// DELETE /api/sessions — delete all sessions.

import { listSessions, deleteAllSessions, countSessions } from "@/lib/session-store";

export async function GET() {
  const sessions = listSessions(50, 0);
  return Response.json({ ok: true, sessions, total: countSessions() });
}

export async function DELETE() {
  const deleted = deleteAllSessions();
  return Response.json({ ok: true, deleted });
}
