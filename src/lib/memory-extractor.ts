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

import { getLLM, type LLMMessage } from "./llm-provider";
import { embed } from "./embeddings";
import { getDb, isPostgresAvailable, getPrismaDb } from "./db";
import { env } from "./env";

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
    console.warn("[memory-extractor] LLM extraction failed:", err instanceof Error ? err.message : String(err));
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
          const existing = await (prisma as any).longTermMemory.findFirst({
            where: { userId: uid, content: { contains: mem.content.slice(0, 50) } },
          });
          if (existing) {
            // Update confidence if higher.
            if (mem.confidence > existing.confidence) {
              await (prisma as any).longTermMemory.update({
                where: { id: existing.id },
                data: { confidence: mem.confidence },
              });
            }
            continue;
          }

          // Embed the memory content.
          const embedding = await embed(mem.content);

          await (prisma as any).longTermMemory.create({
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
      console.warn("[memory-extractor] Postgres store failed:", err instanceof Error ? err.message : String(err));
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
        .get(uid, `%${mem.content.slice(0, 50)}%`);
      if (existing) {
        // Update confidence if higher.
        db.prepare("UPDATE long_term_memories SET confidence = ? WHERE id = ? AND confidence < ?")
          .run(mem.confidence, (existing as any).id, mem.confidence);
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
    console.warn("[memory-extractor] SQLite store failed:", err instanceof Error ? err.message : String(err));
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
        const memories = await (prisma as any).longTermMemory.findMany({
          where: type ? { userId: uid, type } : { userId: uid },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return memories.map((m: any) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          confidence: m.confidence,
          createdAt: m.createdAt?.toISOString?.() || String(m.createdAt),
          accessCount: m.accessCount || 0,
        }));
      }
    } catch (err) {
      console.warn("[memory-extractor] Postgres getMemories failed:", err instanceof Error ? err.message : String(err));
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    const rows = type
      ? db.prepare("SELECT * FROM long_term_memories WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 100").all(uid, type)
      : db.prepare("SELECT * FROM long_term_memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(uid);
    return (rows as any[]).map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      confidence: r.confidence,
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
        await (prisma as any).longTermMemory.delete({ where: { id } });
        return true;
      }
    } catch { /* fall through */ }
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
