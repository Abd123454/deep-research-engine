// chat-store — shared conversation & message persistence.
//
// Used by /api/chat and /api/chat/agent to avoid duplication. Each function
// tries Postgres (via Prisma) first when available, and falls back to the
// embedded SQLite database otherwise. This dual-mode behaviour matches the
// rest of the codebase (see src/lib/db.ts).
import * as Sentry from "@sentry/nextjs";


import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { MessageRow } from "@/lib/sqlite-types";

const MAX_HISTORY = 20;

/**
 * A single chat message. `id` and `createdAt` are optional so that callers
 * (e.g. the agent loop in /api/chat/agent) can append synthetic in-flight
 * messages without fabricating identifiers.
 */
export interface ChatMessage {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
}

/**
 * Return an existing conversationId, or create a new conversation row.
 * Uses `INSERT OR IGNORE` on the SQLite path so re-creating the same id is
 * a no-op rather than an error (matches the agent route's prior behaviour).
 */
export async function getOrCreateConversation(
  conversationId: string | null,
  userId: string,
  firstMessage: string
): Promise<string> {
  if (conversationId) return conversationId;

  const id = crypto.randomUUID();
  const title = firstMessage.slice(0, 50);

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await prisma.conversation.create({
          data: { id, userId, title },
        });
        return conv.id;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }

  // SQLite fallback.
  try {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, userId, title);
  } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
  return id;
}

/**
 * Persist a single message. `tokensUsed` and `modelUsed` are optional for
 * callers that do not track token accounting (e.g. the agent loop).
 */
export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  tokensUsed?: number,
  modelUsed?: string
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.message.create({
          data: { id, conversationId, role, content, tokensUsed: tokensUsed || 0, modelUsed },
        });
        return;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO messages (id, conversation_id, role, content, tokens_used, model_used) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, conversationId, role, content, tokensUsed || 0, modelUsed || null
    );
  } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
}

/**
 * Return the most recent messages for a conversation, oldest-first.
 * Limited to the last MAX_HISTORY (20) rows to bound prompt size.
 */
export async function getHistory(conversationId: string): Promise<ChatMessage[]> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
          take: MAX_HISTORY,
        });
        return messages.map((m) => ({
          id: m.id, role: m.role, content: m.content,
          createdAt: m.createdAt?.toISOString?.() || String(m.createdAt),
        }));
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?").all(conversationId, MAX_HISTORY) as MessageRow[];
    return rows.map((r) => ({
      id: r.id, role: r.role, content: r.content, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export const CHAT_MAX_HISTORY = MAX_HISTORY;
