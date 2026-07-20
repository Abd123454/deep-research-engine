// GET    /api/chat/conversations/[id] — get conversation with messages.
// DELETE /api/chat/conversations/[id] — delete conversation + messages.
//
// SECURITY (skills-audit): ownership check added. Previously any
// authenticated user could read or delete ANY other user's conversation
// by guessing/enumerating the conversation ID. Now the conversation's
// `user_id` must match the caller's `userId` — a 404 (not 403) is
// returned for missing or non-owned conversations so we don't leak
// the existence of other users' conversation IDs.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ConversationRow, MessageRow } from "@/lib/sqlite-types";
import { requireAuth, getUserId } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";

/**
 * Verify the caller owns the conversation. Returns `null` on success
 * or a 404 NextResponse when the conversation is missing or belongs
 * to a different user (404 — not 403 — to avoid leaking existence).
 */
async function verifyConversationOwnership(
  id: string,
  userId: string
): Promise<NextResponse | null> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await prisma.conversation.findUnique({
          where: { id },
          select: { userId: true },
        });
        if (!conv || conv.userId !== userId) {
          return NextResponse.json(
            { ok: false, error: "Conversation not found." },
            { status: 404 }
          );
        }
        return null;
      }
    } catch (err) {
      Sentry.captureException(err);
      // Fall through to SQLite check.
    }
  }
  try {
    const db = getDb();
    const conv = db
      .prepare("SELECT user_id FROM conversations WHERE id = ?")
      .get(id) as { user_id?: string } | undefined;
    if (!conv || conv.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 }
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Conversation not found." },
      { status: 404 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { id } = await params;
  const ownershipFail = await verifyConversationOwnership(id, userId);
  if (ownershipFail) return ownershipFail;

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
    } catch (err) {
  Sentry.captureException(err);
/* fall through */
}
  }
  try {
    const db = getDb();
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;
    if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100").all(id) as MessageRow[];
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { id } = await params;
  const ownershipFail = await verifyConversationOwnership(id, userId);
  if (ownershipFail) return ownershipFail;

  logSensitiveAction("research.delete", userId, req, {
    resourceType: "conversation",
    conversationId: id,
  });

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.conversation.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */
}
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
