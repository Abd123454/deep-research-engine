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
import { isConsentGranted } from "./consent";
// P1-wave2 / Feature 2: Memory Graph — after storing a new memory,
// extract relations against existing memories and persist them as
// weighted edges in the memory_edges table. The graph powers both the
// /api/memories/graph visualization and recallWithGraph expansion.
import { extractRelations, storeMemoryEdges } from "./memory-graph";

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

      // P1-wave2 / Feature 2: Memory Graph — extract relations between
      // the newly-stored memory and the user's existing memories, then
      // persist them as edges. Wrapped in try/catch so a graph failure
      // never blocks the memory write (the write already succeeded at
      // this point). The query excludes the just-inserted row by id so
      // we don't compute a self-loop.
      try {
        const existingRows = db
          .prepare(
            "SELECT id, content FROM long_term_memories WHERE user_id = ? AND id != ?"
          )
          .all(uid, id) as Array<{ id: string; content: string }>;
        if (existingRows.length > 0) {
          const edges = extractRelations(
            { id, content: mem.content },
            existingRows
          );
          if (edges.length > 0) {
            storeMemoryEdges(edges);
          }
        }
      } catch (graphErr) {
        // Non-fatal — see comment above.
        logger.warn(
          {
            module: "memory-extractor",
            err: graphErr instanceof Error ? graphErr.message : String(graphErr),
          },
          "Memory graph edge extraction failed (non-fatal)"
        );
      }
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
  } catch (err) {
    // Non-critical: SQLite memory fetch failed (DB locked, table missing).
    // Returning an empty list is safe — recall just won't surface any
    // memories for this turn.
    Sentry.captureException(err);
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "getMemories: SQLite fetch failed — returning []"
    );
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
      // Non-critical: Postgres memory delete failed. Fall through to the
      // SQLite path so the memory is still removed from at least one store.
      Sentry.captureException(err);
      logger.warn(
        { module: "memory-extractor", id, err: err instanceof Error ? err.message : String(err) },
        "deleteMemory: Postgres delete failed — falling back to SQLite"
      );
    }
  }
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM long_term_memories WHERE id = ?").run(id);
    return result.changes > 0;
  } catch (err) {
    // Non-critical: SQLite delete failed (DB locked, table missing). The
    // caller treats this as "not deleted" — the memory may resurface in
    // recall, but the user-facing flow is not blocked.
    Sentry.captureException(err);
    logger.warn(
      { module: "memory-extractor", id, err: err instanceof Error ? err.message : String(err) },
      "deleteMemory: SQLite delete failed"
    );
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
// V3 audit fix — the canonical source of truth for "did this user opt
// in to automatic memory extraction?" is now the **consent_ledger**
// table (see src/lib/consent.ts), not the legacy
// `user_preferences.memory_consent` column. This brings memory
// extraction under GDPR Art. 7 ("demonstrable consent") — every
// grant / revoke is audit-logged via `consent.update`, with a
// timestamp and policy version, in a single table that all consented
// actions read from.
//
// The legacy `memory_consent` column is still written by
// `/api/preferences/memory` POST and `/api/consent` POST (as a
// denormalized cache), but it is no longer READ by this gate. The
// consent ledger is the only source of truth.
//
// Because `isConsentGranted` is async (it queries the DB), this
// function is now async. Callers (`/api/chat`, `/api/chat/agent`,
// `/api/memories/extract`, the memory worker) MUST `await` it. The
// sync `isMemoryExtractionEnabledAsync` alias is kept for backward
// compatibility with route handlers that already used it.
//
// DEFAULT IS FALSE. Memory extraction is opt-in — the user must
// explicitly grant the `memoryExtraction` consent key via
// `/api/consent` or `/api/preferences/memory`.

/**
 * Returns true if the user has granted the `memoryExtraction` consent
 * in the consent ledger.
 *
 * OPT-IN by default: returns false when the user has no ledger row,
 * when the ledger is unavailable, or when the row's `granted` flag is
 * false. Only returns true when the user has explicitly granted the
 * consent (via `/api/consent` or `/api/preferences/memory` POST).
 *
 * V3 audit fix: this is now ASYNC (was sync) because `isConsentGranted`
 * performs a DB query. All callers must `await` it.
 */
export async function isMemoryExtractionEnabled(userId: string): Promise<boolean> {
  // Check the consent ledger first (GDPR Art. 7 compliant). This is
  // the canonical source of truth — the legacy `user_preferences.memory_consent`
  // column is no longer consulted.
  try {
    return await isConsentGranted(userId, "memoryExtraction");
  } catch (err) {
    // The consent ledger lookup threw (DB unavailable, table missing,
    // connection error, …). Fail-closed: memory extraction is opt-in,
    // so when we can't verify consent we MUST NOT extract.
    logger.warn(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "isMemoryExtractionEnabled — consent ledger lookup failed, defaulting to false (opt-in)"
    );
    return false;
  }
}

/**
 * Async alias for `isMemoryExtractionEnabled`. Kept for backward
 * compatibility with route handlers that imported the `_Async` suffix
 * before the V3 audit fix made the canonical function async.
 *
 * @deprecated Use `isMemoryExtractionEnabled` directly — it is now async.
 */
export async function isMemoryExtractionEnabledAsync(userId: string): Promise<boolean> {
  return isMemoryExtractionEnabled(userId);
}

/**
 * Set the user's memory consent flag. Used by /api/preferences/memory
 * and /api/consent (as a side-effect when `memoryExtraction` changes).
 *
 * V3 audit fix: this writes ONLY to the legacy `user_preferences.memory_consent`
 * column as a denormalized cache. The canonical source of truth is the
 * `consent_ledger` table (written by `setConsent()` in `consent.ts`).
 * The legacy column is kept in sync so any code paths that haven't yet
 * migrated to read the ledger continue to see consistent state.
 */
const LEGACY_CONSENT_COLUMN = "memory_consent";

function ensureConsentColumn(): void {
  try {
    const db = getDb();
    // SQLite: ALTER TABLE ADD COLUMN is silent if the column already
    // exists when wrapped in try/catch (the duplicate-column error is
    // caught).
    db.exec(`ALTER TABLE user_preferences ADD COLUMN ${LEGACY_CONSENT_COLUMN} INTEGER DEFAULT 0`);
  } catch (err) {
    // Non-critical: column already exists (expected on subsequent calls).
    // ALTER TABLE ADD COLUMN is idempotent at the application layer but
    // not at the SQL layer — SQLite raises a duplicate-column error.
    Sentry.captureException(err);
    logger.debug(
      { module: "memory-extractor", err: err instanceof Error ? err.message : String(err) },
      "ensureLegacyConsentColumn: column already exists (expected)"
    );
  }
}

export function setMemoryExtractionConsent(userId: string, enabled: boolean): void {
  try {
    ensureConsentColumn();
    const db = getDb();
    const value = enabled ? 1 : 0;
    db.prepare(
      `INSERT INTO user_preferences (user_id, ${LEGACY_CONSENT_COLUMN})
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ${LEGACY_CONSENT_COLUMN} = excluded.${LEGACY_CONSENT_COLUMN}`
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
