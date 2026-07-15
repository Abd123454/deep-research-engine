// GET  /api/chat/conversations — list user's conversations.
// POST /api/chat/conversations — create new conversation.

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";

const DEFAULT_USER_ID = "default";

export async function GET() {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const convs = await (prisma as any).conversation.findMany({
          where: { userId: DEFAULT_USER_ID },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { _count: { select: { messages: true } } },
        });
        return NextResponse.json({ ok: true, conversations: convs.map((c: any) => ({
          id: c.id, title: c.title, messageCount: c._count?.messages || 0,
          createdAt: c.createdAt?.toISOString?.() || String(c.createdAt),
          updatedAt: c.updatedAt?.toISOString?.() || String(c.updatedAt),
        })) });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count
      FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 50
    `).all(DEFAULT_USER_ID) as any[];
    return NextResponse.json({ ok: true, conversations: rows.map((r) => ({
      id: r.id, title: r.title, messageCount: r.msg_count,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) });
  } catch {
    return NextResponse.json({ ok: true, conversations: [] });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = body.title || "New Conversation";
  const id = crypto.randomUUID();

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await (prisma as any).conversation.create({
          data: { id, userId: DEFAULT_USER_ID, title },
        });
        return NextResponse.json({ ok: true, conversation: { id: conv.id, title: conv.title } });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, DEFAULT_USER_ID, title);
    return NextResponse.json({ ok: true, conversation: { id, title } });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to create conversation." }, { status: 500 });
  }
}
