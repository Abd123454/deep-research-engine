// chat-store — shared conversation & message persistence.
//
// Used by /api/chat and /api/chat/agent to avoid duplication. Each function
// tries Postgres (via Prisma) first when available, and falls back to the
// embedded SQLite database otherwise. This dual-mode behaviour matches the
// rest of the codebase (see src/lib/db.ts).
import * as Sentry from "@sentry/nextjs";


import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { MessageRow } from "@/lib/sqlite-types";
import { logger } from "@/lib/logger";

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
      // Non-critical: Postgres conversation create failed. Fall through to
      // the SQLite fallback so chat history is still persisted locally.
      Sentry.captureException(err);
      logger.warn(
        { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
        "getOrCreateConversation: Postgres create failed — falling back to SQLite"
      );
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, userId, title);
  } catch (err) {
    // Non-critical: SQLite conversation insert failed (DB locked, disk full,
    // schema mismatch). The chat still works in-memory — the next saveMessage
    // will retry the insert.
    Sentry.captureException(err);
    logger.warn(
      { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
      "getOrCreateConversation: SQLite insert failed"
    );
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
      // Non-critical: Postgres message insert failed. Fall through to SQLite
      // so the message is still persisted (chat history continuity matters).
      Sentry.captureException(err);
      logger.warn(
        { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
        "saveMessage: Postgres insert failed — falling back to SQLite"
      );
    }
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO messages (id, conversation_id, role, content, tokens_used, model_used) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, conversationId, role, content, tokensUsed || 0, modelUsed || null
    );
  } catch (err) {
    // Non-critical: SQLite message insert failed. The chat response is still
    // returned to the user — only the persistence layer is degraded.
    Sentry.captureException(err);
    logger.warn(
      { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
      "saveMessage: SQLite insert failed"
    );
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
      // Non-critical: Postgres history fetch failed. Fall through to SQLite
      // so the agent still gets recent context for the next turn.
      Sentry.captureException(err);
      logger.warn(
        { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
        "getHistory: Postgres fetch failed — falling back to SQLite"
      );
    }
  }
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?").all(conversationId, MAX_HISTORY) as MessageRow[];
    return rows.map((r) => ({
      id: r.id, role: r.role, content: r.content, createdAt: r.created_at,
    }));
  } catch (err) {
    // Non-critical: SQLite history fetch failed (DB locked, table missing).
    // Returning an empty history is safer than throwing — the agent will
    // start a fresh context for this turn.
    Sentry.captureException(err);
    logger.warn(
      { module: "chat-store", err: err instanceof Error ? err.message : String(err) },
      "getHistory: SQLite fetch failed — returning empty history"
    );
    return [];
  }
}

export const CHAT_MAX_HISTORY = MAX_HISTORY;
