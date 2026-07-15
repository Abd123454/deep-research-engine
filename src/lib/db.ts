// Database client — dual-mode: Postgres (production) or SQLite (development).
//
// If DATABASE_URL starts with "postgresql://", uses Prisma + Postgres.
// Otherwise, falls back to better-sqlite3 (SQLite) for development.
// If SQLite also fails (read-only FS), falls back to in-memory.
//
// This dual-mode approach allows:
//   - Production: full 5-layer memory system with Postgres + pgvector
//   - Development: SQLite fallback (no Postgres needed to run locally)
//   - Sandbox/CI: in-memory fallback (no filesystem writes needed)

import type { Database as SqliteDatabase } from "better-sqlite3";
import path from "path";
import fs from "fs";

// ---------- Type exports ----------
// The Prisma client is only imported when Postgres is available.
// We export a union type so callers can use either backend.

export type DbType = "postgres" | "sqlite" | "memory";

export let activeDbType: DbType = "memory";

// ---------- Postgres (Prisma) ----------
let prismaClient: unknown = null;

async function getPrisma() {
  if (prismaClient) return prismaClient;
  const { PrismaClient } = await import("../generated/prisma/client");
  prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return prismaClient;
}

// ---------- SQLite (better-sqlite3) ----------
let sqliteInstance: SqliteDatabase | null = null;

function getSqlitePath(): string {
  let dbPath: string;
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("file:")) {
    const p = url.slice(5);
    dbPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  } else {
    dbPath = path.join(process.cwd(), "data", "research.db");
  }
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  }
  return dbPath;
}

function initSqliteSchema(db: SqliteDatabase): void {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      metadata TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);

    -- 5-layer memory tables (SQLite versions — no pgvector, but text search works)
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT 'New Conversation',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      model_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS long_term_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_accessed TEXT,
      access_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_memories_user ON long_term_memories(user_id);

    CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      plan TEXT,
      report TEXT,
      sources TEXT,
      stats TEXT,
      verification_report TEXT,
      status TEXT DEFAULT 'queued',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_research_user ON research_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_research_status ON research_jobs(status);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_length INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      preferred_language TEXT DEFAULT 'auto',
      preferred_depth TEXT DEFAULT 'standard',
      preferred_format TEXT DEFAULT 'markdown',
      preferred_provider TEXT DEFAULT 'auto',
      timezone TEXT
    );
  `);
}

// Dynamic import for better-sqlite3 (native addon — can't be bundled).
const loadBetterSqlite3 = (): typeof import("better-sqlite3") => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("better-sqlite3");
};

function getSqlite(): SqliteDatabase {
  if (sqliteInstance) return sqliteInstance;
  try {
    const Database = loadBetterSqlite3();
    const dbPath = getSqlitePath();
    sqliteInstance = new Database(dbPath) as SqliteDatabase;
    initSqliteSchema(sqliteInstance);
    activeDbType = "sqlite";
  } catch (err) {
    console.warn("[db] SQLite failed, falling back to in-memory:", err instanceof Error ? err.message : String(err));
    const Database = loadBetterSqlite3();
    sqliteInstance = new Database(":memory:") as SqliteDatabase;
    initSqliteSchema(sqliteInstance);
    activeDbType = "memory";
  }
  return sqliteInstance;
}

// ---------- Public API ----------

// For backward compatibility — existing code uses getDb() for SQLite sessions.
export function getDb(): SqliteDatabase {
  return getSqlite();
}

// For Postgres access — returns PrismaClient or null if not available.
export async function getPrismaDb() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("postgresql://")) return null;
  try {
    const prisma = await getPrisma();
    activeDbType = "postgres";
    return prisma;
  } catch (err) {
    console.warn("[db] Postgres failed, falling back to SQLite:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Check if Postgres is configured.
export function isPostgresAvailable(): boolean {
  return (process.env.DATABASE_URL || "").startsWith("postgresql://");
}
