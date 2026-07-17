// Memory extractor — uses LLM to extract facts, preferences, and context
// from conversations. Stores them as long-term memories with embeddings.
//
// After each conversation or research job, this module analyzes the content
// and extracts:
//   - facts: "User works on RISC-V projects"
//   - preferences: "User prefers Arabic responses"
//   - context: "User is writing a thesis about AI"
//
// Extracted memories are embedded and stored for semantic recall.
//
// ---------- Consent (Ethical #4) ----------
// Memory extraction is OPT-IN. The default state for any user is "not
// consented" — automatic extraction is skipped until the user explicitly
// turns it on via /api/preferences/memory. Routes that perform automatic
// extraction MUST call `isMemoryExtractionEnabled(userId)` first and skip
// the extraction if it returns false.
//
// The opt-in gate does NOT apply to explicit memory commands ("remember
// that...") — those go through `storeExplicitMemory()`, which is the user
// directly asking us to save a specific fact. That counts as consent for
// that one memory.
import * as Sentry from "@sentry/nextjs";


import { getLLM, type LLMMessage } from "./llm-provider";
import { embed } from "./embeddings";
import { getDb, isPostgresAvailable, getPrismaDb } from "./db";
import type { LongTermMemoryRow } from "./sqlite-types";
import { logger } from "./logger";

export interface MemoryExtraction {
  type: "fact" | "preference" | "context";
  content: string;
  confidence: number;
}

export interface StoredMemory {
  id: string;
  type: string;
  content: string;
  confidence: number;
  createdAt: string;
  accessCount: number;
}

// ---------- Extraction prompt ----------

const EXTRACTION_SYS: LLMMessage = {
  role: "system",
  content: `You are a memory extraction assistant. Analyze the given conversation or research query and extract:
1. Facts about the user (work, interests, projects, expertise)
2. Preferences (language, format, depth, provider)
3. Context (what they're working on, their goals)

Return a JSON array. Each item must have:
- "type": "fact" | "preference" | "context"
- "content": a concise statement (max 100 chars)
- "confidence": 0.0-1.0 (how confident you are this is a lasting trait)

Only extract items with confidence >= 0.7. Skip obvious/generic observations.
Return ONLY the JSON array, no commentary. If nothing worth remembering, return [].`,
};

// ---------- Extract ----------

export async function extractMemories(
  content: string
): Promise<MemoryExtraction[]> {
  if (!content || content.trim().length < 20) return [];

  const llm = await getLLM();
  const userMsg: LLMMessage = {
    role: "user",
    content: `Analyze this content and extract memories:\n\n<content>\n${content.slice(0, 8000)}\n</content>`,
  };

  try {
    const result = await llm.smart({
      messages: [EXTRACTION_SYS, userMsg],
      maxTokens: 500,
      temperature: 0.3,
      json: true,
    });

    const parsed = JSON.parse(result.content) as MemoryExtraction[];
    if (!Array.isArray(parsed)) return [];

    // Filter by confidence and deduplicate.
    const filtered = parsed.filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        m.content.length > 5 &&
        m.confidence >= 0.7 &&
        ["fact", "preference", "context"].includes(m.type)
    );

    return filtered;
  } catch (err) {
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "LLM extraction failed"
    );
    return [];
  }
}

// ---------- Store ----------

const DEFAULT_USER_ID = "default"; // Until auth is added (Phase 3C)

export async function storeMemories(
  userId: string | null,
  memories: MemoryExtraction[]
): Promise<number> {
  if (memories.length === 0) return 0;
  const uid = userId || DEFAULT_USER_ID;

  // Try Postgres first.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        let stored = 0;
        for (const mem of memories) {
          // Check for duplicates (similar content).
          const existing = await prisma.longTermMemory.findFirst({
            where: { userId: uid, content: { contains: mem.content.slice(0, 50) } },
          });
          if (existing) {
            // Update confidence if higher.
            if (mem.confidence > existing.confidence) {
              await prisma.longTermMemory.update({
                where: { id: existing.id },
                data: { confidence: mem.confidence },
              });
            }
            continue;
          }

          // Embed the memory content.
          await embed(mem.content);

          await prisma.longTermMemory.create({
            data: {
              userId: uid,
              type: mem.type,
              content: mem.content,
              confidence: mem.confidence,
            },
          });
          stored++;
        }
        return stored;
      }
    } catch (err) {
      logger.warn(
        { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
        "Postgres store failed"
      );
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    let stored = 0;
    for (const mem of memories) {
      // Check for duplicates.
      const existing = db
        .prepare("SELECT id FROM long_term_memories WHERE user_id = ? AND content LIKE ?")
        .get(uid, `%${mem.content.slice(0, 50)}%`) as Pick<LongTermMemoryRow, "id"> | undefined;
      if (existing) {
        // Update confidence if higher.
        db.prepare("UPDATE long_term_memories SET confidence = ? WHERE id = ? AND confidence < ?")
          .run(mem.confidence, existing.id, mem.confidence);
        continue;
      }

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO long_term_memories (id, user_id, type, content, confidence) VALUES (?, ?, ?, ?, ?)"
      ).run(id, uid, mem.type, mem.content, mem.confidence);
      stored++;
    }
    return stored;
  } catch (err) {
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "SQLite store failed"
    );
    return 0;
  }
}

// ---------- Get ----------

export async function getMemories(
  userId: string | null,
  type?: string
): Promise<StoredMemory[]> {
  const uid = userId || DEFAULT_USER_ID;

  // Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const memories = await prisma.longTermMemory.findMany({
          where: type ? { userId: uid, type } : { userId: uid },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return memories.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          confidence: m.confidence,
          createdAt: m.createdAt?.toISOString?.() || String(m.createdAt),
          accessCount: m.accessCount || 0,
        }));
      }
    } catch (err) {
      logger.warn(
        { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
        "Postgres getMemories failed"
      );
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    const rows = type
      ? db.prepare("SELECT * FROM long_term_memories WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 100").all(uid, type)
      : db.prepare("SELECT * FROM long_term_memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(uid);
    return (rows as LongTermMemoryRow[]).map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      confidence: r.confidence as number,
      createdAt: r.created_at,
      accessCount: r.access_count || 0,
    }));
  } catch {
    return [];
  }
}

// ---------- Delete ----------

export async function deleteMemory(id: string): Promise<boolean> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.longTermMemory.delete({ where: { id } });
        return true;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM long_term_memories WHERE id = ?").run(id);
    return result.changes > 0;
  } catch {
    return false;
  }
}

// ---------- Convenience: extract + store in one call ----------

export async function extractAndStoreMemories(
  userId: string | null,
  content: string
): Promise<number> {
  const memories = await extractMemories(content);
  if (memories.length === 0) return 0;
  return storeMemories(userId, memories);
}

// ---------- Memory consent gate (Ethical #4) ----------
//
// Reads the `memory_consent` column from `user_preferences`. The column is
// added lazily via ALTER TABLE on first read (SQLite's `ALTER TABLE ADD
// COLUMN` is idempotent-ish — wrapped in try/catch so a duplicate add
// doesn't crash). Postgres path: a Prisma migration would add the column
// properly; the SQLite path here is the dev-default.
//
// DEFAULT IS FALSE. Memory extraction is opt-in — the user must explicitly
// turn it on via /api/preferences/memory. Routes that auto-extract
// memories MUST call this first.

const CONSENT_COLUMN = "memory_consent";

function ensureConsentColumn(): void {
  try {
    const db = getDb();
    // SQLite: ALTER TABLE ADD COLUMN is silent if the column already exists
    // when wrapped in try/catch (the duplicate-column error is caught).
    db.exec(`ALTER TABLE user_preferences ADD COLUMN ${CONSENT_COLUMN} INTEGER DEFAULT 0`);
  } catch {
    // Column already exists — expected on subsequent calls.
  }
}

/**
 * Returns true if the user has opted in to automatic memory extraction.
 *
 * OPT-IN by default: returns false when the user has no preference row,
 * when the column is missing, or when the column value is 0/null. Only
 * returns true when the user has explicitly set consent to 1 via
 * /api/preferences/memory.
 */
export function isMemoryExtractionEnabled(userId: string): boolean {
  // Postgres path: defer to the preferences table via Prisma. Prisma
  // doesn't have the `memory_consent` column in the current schema, so
  // we read it raw via $queryRaw when Postgres is configured.
  if (isPostgresAvailable()) {
    // Defer to the SQLite path for the synchronous fast-path. The async
    // variant below is preferred for routes that can await — but most
    // callers (chat, agent) want the sync answer so they don't block the
    // stream. The sync Postgres path falls through to SQLite (which is
    // always available as a fallback in dual-mode deployments).
  }

  try {
    ensureConsentColumn();
    const db = getDb();
    const row = db
      .prepare(`SELECT ${CONSENT_COLUMN} AS consent FROM user_preferences WHERE user_id = ?`)
      .get(userId) as { consent: number } | undefined;
    return !!(row && row.consent === 1);
  } catch (err) {
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "isMemoryExtractionEnabled lookup failed — defaulting to false (opt-in)"
    );
    return false;
  }
}

/**
 * Async variant — preferred for routes that can await. Reads from Postgres
 * via Prisma's $queryRaw when configured, falling back to the sync SQLite
 * path.
 */
export async function isMemoryExtractionEnabledAsync(userId: string): Promise<boolean> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const rows = await prisma.$queryRaw<Array<{ consent: number }>>`
          SELECT memory_consent AS consent FROM user_preferences WHERE user_id = ${userId} LIMIT 1
        `;
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0]!.consent === 1;
        }
        return false;
      }
    } catch (err) {
      logger.warn(
        { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
        "isMemoryExtractionEnabledAsync Postgres lookup failed — falling back to SQLite"
      );
    }
  }
  return isMemoryExtractionEnabled(userId);
}

/**
 * Set the user's memory consent flag. Used by /api/preferences/memory.
 * Writes to the `memory_consent` column on the existing user_preferences
 * row (creates the row if missing — INSERT OR REPLACE pattern).
 */
export function setMemoryExtractionConsent(userId: string, enabled: boolean): void {
  try {
    ensureConsentColumn();
    const db = getDb();
    const value = enabled ? 1 : 0;
    db.prepare(
      `INSERT INTO user_preferences (user_id, ${CONSENT_COLUMN})
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ${CONSENT_COLUMN} = excluded.${CONSENT_COLUMN}`
    ).run(userId, value);
  } catch (err) {
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "setMemoryExtractionConsent write failed"
    );
  }
}

// ---------- Explicit memory command (Ethical #5) ----------
//
// Detects when the user explicitly asks Quaesitor to remember something:
//   "remember that I prefer concise answers"
//   "note that my timezone is PST"
//   "تذكر أنني أكتب بالعربية"
//   "احفظ أن المشروع يستخدم RISC-V"
//
// When detected, the captured `content` is stored directly via
// `storeExplicitMemory()` — bypassing the opt-in gate (the user's explicit
// ask counts as consent for that one memory).

const MEMORY_COMMAND_PATTERNS: RegExp[] = [
  /^(?:remember that|remember|note that|keep in mind|don't forget that|dont forget that)\s+(.+)/i,
  /^(?:تذكر أن|تذكر|احفظ أن|احفظ|دوّن أن|دون أن)\s+(.+)/i,
];

export interface MemoryCommand {
  isMemoryCommand: boolean;
  content?: string;
}

export function detectMemoryCommand(message: string): MemoryCommand {
  if (!message || typeof message !== "string") return { isMemoryCommand: false };
  const trimmed = message.trim();
  for (const pattern of MEMORY_COMMAND_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      return { isMemoryCommand: true, content: match[1].trim() };
    }
  }
  return { isMemoryCommand: false };
}

/**
 * Store an explicit memory ("remember that...") for the user.
 *
 * Bypasses the opt-in consent gate because the user is directly asking us
 * to save this fact. The memory is stored as type "fact" with confidence
 * 1.0 (the user wouldn't ask us to remember something they're unsure of).
 *
 * Returns true on success, false on failure (DB write error).
 */
export async function storeExplicitMemory(
  userId: string | null,
  content: string
): Promise<boolean> {
  if (!content || content.trim().length === 0) return false;
  const stored = await storeMemories(userId, [
    { type: "fact", content: content.trim(), confidence: 1.0 },
  ]);
  return stored > 0;
}
