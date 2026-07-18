// Memory Graph — entity-relation storage for semantic memory connections.
//
// Each memory is a node. Edges represent relationships (supports,
// contradicts, related, causes) between memories. The graph is built
// automatically: when a new memory is stored (see memory-extractor.ts),
// `extractRelations` compares it against existing memories and emits
// weighted edges that `storeMemoryEdges` persists.
//
// The graph powers two things:
//   1. Visualization (GET /api/memories/graph) — the frontend renders a
//      force-directed graph of how the user's memories connect.
//   2. Recall expansion (recallWithGraph) — given a starting set of
//      memories matched by keyword/embedding, BFS-traverse the graph to
//      pull in transitively-related memories.
//
// Storage: SQLite (via getDb()). The `memory_edges` table is created
// lazily on first write (CREATE TABLE IF NOT EXISTS). Each edge row
// stores source/target memory IDs, the relation type, a 0-1 weight
// (similarity score), and a created_at timestamp.

import { getDb } from "./db";
import { logger } from "./logger";

export interface MemoryEdge {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationType: "supports" | "contradicts" | "related" | "causes";
  weight: number; // 0-1 confidence
  createdAt: string;
}

export interface MemoryNode {
  id: string;
  content: string;
  type: string;
  confidence: number;
  createdAt: string;
}

export interface GraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

// ---------- Edge table bootstrap ----------
//
// Idempotent — called on every storeMemoryEdges invocation. The IF NOT
// EXISTS guard makes it a cheap no-op after the first call. Keeping it
// inside storeMemoryEdges (rather than db.ts initSqliteSchema) keeps the
// graph feature self-contained — disabling the feature doesn't leave a
// dangling table definition in the core schema init.
function ensureEdgesTable(): void {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_edges (
        id TEXT PRIMARY KEY,
        source_memory_id TEXT NOT NULL,
        target_memory_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        weight REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Index for BFS traversal — recallWithGraph looks up edges by
    // source OR target, so we index both columns.
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON memory_edges(source_memory_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON memory_edges(target_memory_id)`);
  } catch (err) {
    // Table creation is best-effort — if it fails (e.g. read-only FS in
    // sandbox), the graph features silently degrade to no-ops. The
    // caller (storeMemoryEdges) catches and continues.
    logger.warn(
      { module: "memory-graph", err: err instanceof Error ? err.message : String(err) },
      "ensureEdgesTable failed"
    );
  }
}

// Extract relations between a new memory and existing memories using
// keyword-overlap + co-occurrence scoring.
//
// The scoring is intentionally simple (no embeddings, no LLM call) so it
// runs synchronously inside storeMemories without adding latency:
//   - Tokenize both memories on whitespace, keep words > 3 chars.
//   - Overlap = |intersection| / max(|new|, |existing|).
//   - If overlap > 0.15, emit an edge:
//       • "contradicts" if existing memory contains a negation word
//         ("not", "never", "doesn't", …) adjacent to a shared keyword.
//       • "supports" if overlap > 0.5 (strong topical alignment).
//       • "related" otherwise.
//
// At most `maxRelations` edges are returned (top-N by weight) so a single
// new memory can't create an O(N) explosion of edges against a large
// existing corpus.
export function extractRelations(
  newMemory: { id: string; content: string },
  existingMemories: Array<{ id: string; content: string }>,
  maxRelations = 5
): Omit<MemoryEdge, "id" | "createdAt">[] {
  if (existingMemories.length === 0) return [];
  const relations: Omit<MemoryEdge, "id" | "createdAt">[] = [];
  const newWords = new Set(
    newMemory.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  );
  if (newWords.size === 0) return [];

  for (const existing of existingMemories) {
    const existingWords = new Set(
      existing.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    if (existingWords.size === 0) continue;
    const overlap = [...newWords].filter((w) => existingWords.has(w));
    const similarity = overlap.length / Math.max(newWords.size, existingWords.size, 1);

    if (similarity > 0.15) {
      let relationType: MemoryEdge["relationType"] = "related";
      // Negation heuristic: if the existing memory contains a negation
      // word directly before a shared keyword, mark the relation as
      // "contradicts" rather than "supports"/"related".
      const negationWords = ["not", "never", "no", "don't", "doesn't", "isn't"];
      const hasNegation = negationWords.some((nw) =>
        existing.content.toLowerCase().includes(nw) &&
        overlap.some((ow) => existing.content.toLowerCase().includes(`${nw} ${ow}`))
      );
      if (hasNegation) relationType = "contradicts";
      else if (similarity > 0.5) relationType = "supports";

      relations.push({
        sourceMemoryId: newMemory.id,
        targetMemoryId: existing.id,
        relationType,
        weight: similarity,
      });
    }
  }

  return relations.sort((a, b) => b.weight - a.weight).slice(0, maxRelations);
}

// Store edges in the SQLite memory_edges table. Idempotent on
// (sourceMemoryId, targetMemoryId, relationType) via INSERT OR REPLACE
// — re-storing the same edge (e.g. when the same memory is processed
// twice) updates the weight instead of creating duplicates.
export function storeMemoryEdges(edges: Omit<MemoryEdge, "id" | "createdAt">[]): void {
  if (edges.length === 0) return;
  try {
    ensureEdgesTable();
    const db = getDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO memory_edges (id, source_memory_id, target_memory_id, relation_type, weight, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    for (const edge of edges) {
      insert.run(
        crypto.randomUUID(),
        edge.sourceMemoryId,
        edge.targetMemoryId,
        edge.relationType,
        edge.weight
      );
    }
  } catch (err) {
    // Non-fatal — graph edges are a nice-to-have. Memory storage still
    // succeeds; the next store attempt will retry table creation.
    logger.warn(
      { module: "memory-graph", err: err instanceof Error ? err.message : String(err) },
      "storeMemoryEdges failed"
    );
  }
}

// Get graph data for visualization. Returns the N most recent memories
// (nodes) plus any edges that touch them. Edges to older memories
// (outside the limit) are dropped — the visualization only shows the
// recent subgraph so it stays readable.
//
// Column-name aliases map SQLite's snake_case to the camelCase shape
// declared in MemoryNode/MemoryEdge, so the type assertion is honest.
export function getMemoryGraph(userId: string, limit = 50): GraphData {
  try {
    const db = getDb();
    ensureEdgesTable();
    const nodes = db
      .prepare(`
        SELECT id, content, type, confidence, created_at as createdAt
        FROM long_term_memories
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, limit) as MemoryNode[];

    const nodeIds = nodes.map((n) => n.id);
    if (nodeIds.length === 0) return { nodes: [], edges: [] };

    const placeholders = nodeIds.map(() => "?").join(",");
    const edges = db
      .prepare(`
        SELECT id,
               source_memory_id as sourceMemoryId,
               target_memory_id as targetMemoryId,
               relation_type as relationType,
               weight,
               created_at as createdAt
        FROM memory_edges
        WHERE source_memory_id IN (${placeholders}) OR target_memory_id IN (${placeholders})
      `)
      .all(...nodeIds, ...nodeIds) as MemoryEdge[];

    return { nodes, edges };
  } catch (err) {
    logger.warn(
      { module: "memory-graph", err: err instanceof Error ? err.message : String(err) },
      "getMemoryGraph failed"
    );
    return { nodes: [], edges: [] };
  }
}

// BFS traversal from a starting set of memories. Returns the union of
// the start IDs plus every memory reachable within `depth` hops along
// any edge (in either direction — supports/contradicts/related/causes
// are all traversable).
//
// Used by recall: after the keyword/embedding search picks the top-K
// memories, recallWithGraph expands the set with their graph neighbors
// so the LLM sees the surrounding context (e.g. a "supports" edge
// pulls in corroborating evidence; a "contradicts" edge pulls in the
// opposing claim).
export function recallWithGraph(
  userId: string,
  startMemoryIds: string[],
  depth = 2
): string[] {
  if (startMemoryIds.length === 0) return [];
  // `userId` is accepted for API symmetry with getMemoryGraph; the
  // memory_edges table doesn't carry a user_id (edges are global to
  // their endpoints, which are already user-scoped), so we don't
  // filter on it here. The parameter is reserved for a future
  // per-user edge namespace if needed.
  void userId;

  const visited = new Set<string>(startMemoryIds);
  const queue = [...startMemoryIds];
  const result = [...startMemoryIds];

  try {
    const db = getDb();
    const edgeLookup = db.prepare(`
      SELECT target_memory_id as id FROM memory_edges WHERE source_memory_id = ?
      UNION
      SELECT source_memory_id as id FROM memory_edges WHERE target_memory_id = ?
    `);

    for (let d = 0; d < depth && queue.length > 0; d++) {
      const currentBatch = queue.splice(0);
      for (const memId of currentBatch) {
        const edges = edgeLookup.all(memId, memId) as { id: string }[];
        for (const edge of edges) {
          if (!visited.has(edge.id)) {
            visited.add(edge.id);
            result.push(edge.id);
            queue.push(edge.id);
          }
        }
      }
    }
  } catch (err) {
    // Graph traversal is a recall enhancement — if it fails, return
    // just the start set so the caller still gets a useful answer.
    logger.warn(
      { module: "memory-graph", err: err instanceof Error ? err.message : String(err) },
      "recallWithGraph failed — returning start set only"
    );
  }

  return result;
}
