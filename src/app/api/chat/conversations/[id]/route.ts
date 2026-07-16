// GET    /api/chat/conversations/[id] — get conversation with messages.
// DELETE /api/chat/conversations/[id] — delete conversation + messages.

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await prisma.conversation.findUnique({
          where: { id },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
        });
        if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });
        return NextResponse.json({ ok: true, conversation: conv });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as any;
    if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100").all(id) as any[];
    return NextResponse.json({
      ok: true,
      conversation: {
        ...conv,
        messages: messages.map((m) => ({
          id: m.id, role: m.role, content: m.content,
          tokensUsed: m.tokens_used, modelUsed: m.model_used,
          createdAt: m.created_at,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.conversation.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
