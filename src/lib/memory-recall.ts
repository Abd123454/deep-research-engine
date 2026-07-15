// Memory recall — semantic search over long-term memories.
//
// When the user sends a new message or starts a research job, this module
// finds relevant memories from past conversations and injects them into
// the LLM's system prompt.
//
// Two modes:
//   1. Vector search (Postgres + pgvector): cosine similarity on embeddings.
//   2. Text search (SQLite fallback): LIKE search on content keywords.
//
// Results are boosted by recency and access frequency.

import { embed } from "./embeddings";
import { getDb, isPostgresAvailable, getPrismaDb } from "./db";

const DEFAULT_USER_ID = "default";

export interface RecalledMemory {
  id: string;
  type: string;
  content: string;
  confidence: number;
  similarity: number;
  score: number; // similarity * recency_boost * access_boost
  createdAt: string;
  lastAccessed: string | null;
}

// ---------- Recency boost ----------

function recencyBoost(createdAt: string | Date | null): number {
  if (!createdAt) return 1.0;
  const created = new Date(typeof createdAt === "string" ? createdAt : createdAt.toISOString());
  const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  // Recent memories get up to 1.5x boost, old memories approach 1.0.
  return Math.max(1.0, 1.5 - daysSince * 0.01);
}

function accessBoost(accessCount: number): number {
  // Frequently accessed memories get up to 1.3x boost.
  return Math.min(1.3, 1.0 + accessCount * 0.05);
}

// ---------- Recall ----------

export async function recallRelevantMemories(
  userId: string | null,
  query: string,
  limit: number = 5
): Promise<RecalledMemory[]> {
  const uid = userId || DEFAULT_USER_ID;
  if (!query || query.trim().length < 3) return [];

  // Try vector search first (requires embedding + Postgres).
  const embeddingResult = await embed(query);
  if (embeddingResult.vector.length > 0 && isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // pgvector cosine similarity search via raw SQL.
        const vectorStr = `[${embeddingResult.vector.join(",")}]`;
        const memories = await (prisma as any).$queryRaw`
          SELECT id, type, content, confidence, created_at, last_accessed, access_count,
                 1 - (embedding <=> ${vectorStr}::vector) as similarity
          FROM long_term_memories
          WHERE user_id = ${uid}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `;

        const results = (memories as any[]).map((m) => {
          const recency = recencyBoost(m.created_at);
          const access = accessBoost(m.access_count || 0);
          return {
            id: m.id,
            type: m.type,
            content: m.content,
            confidence: m.confidence,
            similarity: m.similarity || 0,
            score: (m.similarity || 0) * recency * access,
            createdAt: m.created_at?.toISOString?.() || String(m.created_at),
            lastAccessed: m.last_accessed?.toISOString?.() || null,
          };
        });

        // Update access count for recalled memories.
        for (const r of results) {
          await (prisma as any).longTermMemory.update({
            where: { id: r.id },
            data: { accessCount: { increment: 1 }, lastAccessed: new Date() },
          }).catch(() => {});
        }

        return results.sort((a, b) => b.score - a.score);
      }
    } catch (err) {
      console.warn("[memory-recall] Vector search failed:", err instanceof Error ? err.message : String(err));
    }
  }

  // SQLite fallback: keyword search (LIKE) + in-memory cosine on stored embeddings.
  try {
    const db = getDb();
    // Extract keywords from the query.
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    // Build LIKE conditions.
    const conditions = keywords.map(() => "content LIKE ?").join(" OR ");
    const params = keywords.map((k) => `%${k}%`);
    const rows = db
      .prepare(
        `SELECT * FROM long_term_memories WHERE user_id = ? AND (${conditions}) ORDER BY created_at DESC LIMIT ?`
      )
      .all(uid, ...params, limit * 2) as any[];

    const results: RecalledMemory[] = rows.map((r) => {
      // Simple keyword-match score (0-1 based on how many keywords matched).
      const matchedKeywords = keywords.filter((k) =>
        r.content?.toLowerCase().includes(k)
      ).length;
      const keywordScore = matchedKeywords / keywords.length;
      const recency = recencyBoost(r.created_at);
      const access = accessBoost(r.access_count || 0);
      return {
        id: r.id,
        type: r.type,
        content: r.content,
        confidence: r.confidence,
        similarity: keywordScore,
        score: keywordScore * recency * access,
        createdAt: r.created_at,
        lastAccessed: r.last_accessed,
      };
    });

    // Sort by score and take top `limit`.
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch (err) {
    console.warn("[memory-recall] SQLite search failed:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ---------- Inject into prompt ----------

export function injectMemoriesIntoPrompt(
  systemPrompt: string,
  memories: RecalledMemory[]
): string {
  if (memories.length === 0) return systemPrompt;

  const memoryLines = memories
    .map((m) => `- [${m.type}] ${m.content} (confidence: ${m.confidence.toFixed(2)})`)
    .join("\n");

  return (
    systemPrompt +
    `\n\n--- RELEVANT MEMORIES FROM PAST INTERACTIONS ---\n` +
    `The following are facts/preferences/context learned from the user's past interactions. ` +
    `Use these to personalize your response:\n${memoryLines}\n` +
    `--- END MEMORIES ---`
  );
}

// ---------- Convenience: recall + inject in one call ----------

export async function recallAndInject(
  userId: string | null,
  query: string,
  systemPrompt: string,
  limit: number = 5
): Promise<string> {
  const memories = await recallRelevantMemories(userId, query, limit);
  return injectMemoriesIntoPrompt(systemPrompt, memories);
}
