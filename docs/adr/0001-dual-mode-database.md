# ADR-0001: Dual-mode Database (SQLite + Postgres)

## Status
Accepted (2026-07-16)

## Context
Quaesitor needs to run in three very different environments:

1. **Local development** on a contributor's laptop, where spinning up
   Postgres + pgvector just to try the project is a high friction barrier.
2. **Production / self-hosted deployments** that need durability, concurrency,
   and semantic-vector search at scale.
3. **Sandbox / CI environments** with a read-only filesystem, where neither
   Postgres nor a writable SQLite file is guaranteed to exist.

The persistence layer backs every feature — chat history, research sessions,
long-term memories, file artifacts — so it has to work uniformly across all
three. The previous "Postgres-only" design (with Prisma) made `bun run dev`
fail on day one for anyone who hadn't installed Postgres, which suppressed
contributions.

## Decision
Implement a dual-mode database (`src/lib/db.ts`) where the same caller code
runs against either backend transparently:

- If `DATABASE_URL` starts with `postgresql://`, use Prisma against Postgres
  (with `pgvector` for the memory layers).
- Otherwise, fall back to `better-sqlite3` against a local `data/research.db`
  file, with the same schema mirrored in `initSqliteSchema()`.
- If SQLite cannot open a writable file, fall back again to an in-memory
  database so the process never hard-crashes.

Every persistence helper (e.g. `chat-store.ts`, `research-store.ts`,
`memory-recall.ts`) uses `isPostgresAvailable()` to pick the path, and
swallows per-backend errors so a degraded backend degrades gracefully rather
than throwing.

## Consequences
**Pros**
- `git clone && bun install && bun dev` works with zero external services.
- Production users get a real RDBMS with vector search.
- CI/sandbox runs still work even on read-only filesystems.

**Cons**
- Two schema definitions to keep in sync (`prisma/schema.prisma` and
  `initSqliteSchema()`); migrations can drift.
- SQLite cannot do true cosine vector search, so the memory-recall path
  falls back to `LIKE` keyword search (see ADR-0004).
- Slightly more test surface (every store has both paths).

## Alternatives considered
- **Postgres-only with Docker Compose.** Rejected — too heavy for first-time
  contributors; many of them never came back after the first `docker compose
  up` failure.
- **SQLite-only with `sqlite-vec`.** Rejected — production users want
  Postgres operational tooling (backups, replication, monitoring).
- **An ORM abstraction layer (e.g. Drizzle) to hide both.** Rejected for
  now — Prisma already gives us Postgres, and adding another ORM would
  increase bundle size and surface area without removing the need for the
  SQLite fallback.
