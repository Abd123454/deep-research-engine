// GET    /api/sessions/[id] — get full session with content.
// DELETE /api/sessions/[id] — delete a single session.

import { NextRequest } from "next/server";
import { getSession, deleteSession } from "@/lib/session-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }
  return Response.json({ ok: true, session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteSession(id);
  if (!deleted) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
