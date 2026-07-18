// pgvector migration — lazily enables the `vector` extension and adds
// `embedding vector(1536)` columns to the tables that need semantic
// search (long_term_memories, messages, documents) on Postgres.
//
// WHEN THIS RUNS:
//   - Only when Postgres is configured (`DATABASE_URL=postgresql://...`).
//   - Lazily, on the first call to `ensurePgvector()` — typically from
//     `recallRelevantMemories` in `src/lib/memory-recall.ts`. We do NOT
//     run it at boot to keep startup fast and to avoid blocking on a
//     DB round-trip when no semantic search is happening.
//   - Idempotent: `CREATE EXTENSION IF NOT EXISTS` and
//     `ADD COLUMN IF NOT EXISTS` are no-ops on subsequent calls.
//
// SQLITE FALLBACK:
//   SQLite has no vector type. When Postgres is NOT configured, this
//   module is a no-op — recall falls back to LIKE search on `content`
//   (see `src/lib/memory-recall.ts`). The SQLite schema in
//   `src/lib/db.ts initSqliteSchema()` deliberately does not add an
//   `embedding` column.
//
// PRISMA INTEGRATION:
//   The `embedding` field on the `Message`, `LongTermMemory`, and
//   `DocumentRecord` models is declared as `Unsupported("vector(1536)")?`
//   in `prisma/schema.prisma`. Prisma skips the column in queries, so
//   this module is responsible for creating + maintaining it via raw SQL.
//   Reads/writes to the embedding column happen through `$queryRaw` in
//   `memory-recall.ts` (recall) and `memory-extractor.ts` (store).
//
// pgvector requires Postgres + `CREATE EXTENSION vector`. SQLite falls
// back to LIKE.

import { isPostgresAvailable, getPrismaDb } from "./db";
import { logger } from "./logger";

// Singleton: ensure the migration runs at most once per process.
let migrationPromise: Promise<void> | null = null;
let migrationDone = false;

/**
 * Ensure the pgvector extension is installed and that the three tables
 * that need semantic search have their `embedding vector(1536)` column.
 *
 * Safe to call repeatedly — every statement is `IF NOT EXISTS`. Returns
 * immediately on SQLite (no-op).
 *
 * Returns a promise so callers can `await` it the first time, but the
 * result is cached — subsequent calls resolve on the next tick.
 */
export function ensurePgvector(): Promise<void> {
  if (migrationDone) return Promise.resolve();
  if (migrationPromise) return migrationPromise;

  // SQLite / no-DB path — never run pgvector migration.
  if (!isPostgresAvailable()) {
    migrationDone = true;
    return Promise.resolve();
  }

  migrationPromise = (async () => {
    try {
      const prisma = await getPrismaDb();
      if (!prisma) {
        // Postgres URL was set but Prisma client failed to construct —
        // recall will fall back to LIKE search. Don't retry every call.
        migrationDone = true;
        return;
      }

      // 1. Install the extension. Requires Postgres superuser OR the
      //    `rds_superuser` / `pgvector` role on managed Postgres. If
      //    this fails, the columns can't be added either — we log and
      //    bail (recall falls back to LIKE).
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;

      // 2. Add the `embedding` column to each table that does semantic
      //    search. `ADD COLUMN IF NOT EXISTS` was added in Postgres 9.6
      //    so this is universally safe on any supported version.
      //
      //    Dimension 1536 matches the OpenAI text-embedding-3-small
      //    model (the highest-dim provider in our fallback chain).
      //    NVIDIA nv-embed-v1 (1024 dims) is right-padded to 1536 by
      //    the storage layer (see `memory-extractor.ts`).
      await prisma.$executeRaw`
        ALTER TABLE long_term_memories
        ADD COLUMN IF NOT EXISTS embedding vector(1536)
      `;
      await prisma.$executeRaw`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS embedding vector(1536)
      `;
      await prisma.$executeRaw`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS embedding vector(1536)
      `;

      // 3. Index the embedding columns for cosine-similarity search.
      //    ivfflat requires `lists` tuning based on row count; for the
      //    default install we use 100 lists (good for ~100k rows). The
      //    index is created `IF NOT EXISTS` so it's a no-op on restart.
      //    On a fresh table this is cheap; on a large table it can take
      //    a while — operators should run it manually during a maintenance
      //    window if the table is already large. We use `CONCURRENTLY` is
      //    NOT supported inside `$executeRaw` transactions, so we drop it.
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_long_term_memories_embedding
        ON long_term_memories USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_messages_embedding
        ON messages USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_documents_embedding
        ON documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;

      migrationDone = true;
      logger.info(
        { module: "pgvector-migration" },
        "pgvector extension + embedding columns ready"
      );
    } catch (err) {
      // Don't cache the failure — the next call will retry. This is
      // important because the extension install can fail due to a
      // transient connection issue, and we want recall to keep trying
      // to enable pgvector rather than permanently falling back to LIKE.
      migrationDone = false;
      migrationPromise = null;
      logger.warn(
        {
          module: "pgvector-migration",
          err: err instanceof Error ? err.message : String(err),
        },
        "pgvector migration failed — recall will use LIKE fallback"
      );
    }
  })();

  return migrationPromise;
}

/**
 * Synchronous check: has `ensurePgvector()` completed successfully in
 * this process? Used by recall to decide whether to attempt a vector
 * search (skipping the embed() call entirely when pgvector is known to
 * be unavailable).
 */
export function isPgvectorReady(): boolean {
  return migrationDone && isPostgresAvailable();
}
