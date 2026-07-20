// GET  /api/chat/conversations — list user's conversations.
// POST /api/chat/conversations — create new conversation.
//
// P0-4 (intensive audit): the route now resolves the caller's identity
// via `getUserId(req)` so conversations are scoped to the authenticated
// user (or the `anon:default` bucket when auth is configured but the
// caller is unauthenticated — see `src/lib/auth.ts`). Previously this
// hardcoded `userId = "default"`, which mixed every tenant's
// conversations into the same list.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import type { ConversationWithCountRow } from "@/lib/sqlite-types";

export async function GET(req: NextRequest) {
  // SECURITY (skills-audit): require auth so anonymous callers cannot
  // create conversations in the "anon:default" bucket when auth is
  // configured. /api/chat already enforces this — /api/chat/conversations
  // was inconsistent and allowed unauthenticated listing + creation.
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const convs = await prisma.conversation.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { _count: { select: { messages: true } } },
        });
        return NextResponse.json({ ok: true, conversations: convs.map((c) => ({
          id: c.id, title: c.title, messageCount: c._count?.messages || 0,
          createdAt: c.createdAt?.toISOString?.() || String(c.createdAt),
          updatedAt: c.updatedAt?.toISOString?.() || String(c.updatedAt),
        })) });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count
      FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 50
    `).all(userId) as ConversationWithCountRow[];
    return NextResponse.json({ ok: true, conversations: rows.map((r) => ({
      id: r.id, title: r.title, messageCount: r.msg_count,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: true, conversations: [] });
  }
}

export async function POST(req: NextRequest) {
  // SECURITY (skills-audit): require auth on conversation creation too
  // (see GET above for rationale — same fix applied symmetrically).
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);
  const body = await req.json().catch(() => ({}));
  const title = body.title || "New Conversation";
  const id = crypto.randomUUID();

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await prisma.conversation.create({
          data: { id, userId, title },
        });
        return NextResponse.json({ ok: true, conversation: { id: conv.id, title: conv.title } });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, userId, title);
    return NextResponse.json({ ok: true, conversation: { id, title } });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Failed to create conversation." }, { status: 500 });
  }
}
