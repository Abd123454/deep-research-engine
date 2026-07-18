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
import * as Sentry from "@sentry/nextjs";


import type { Database as SqliteDatabase } from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { PrismaClient } from "../generated/prisma/client";
import { logger } from "./logger";

// ---------- Type exports ----------
// The Prisma client is only imported when Postgres is available.
// We export a union type so callers can use either backend.

export type DbType = "postgres" | "sqlite" | "memory";

export let activeDbType: DbType = "memory";

// ---------- Postgres (Prisma) ----------
let prismaClient: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient | null> {
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
    dbPath = path.isAbsolute(p) ? p : path.join(/*turbopackIgnore: true*/ process.cwd(), p);
  } else {
    dbPath = path.join(process.cwd(), "data", "research.db");
  }
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
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

    -- Auxiliary tables (previously lazily created in route handlers —
    -- moved here to fix schema drift so all tables exist on first startup).
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      credentials TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_connectors_project ON connectors(project_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      stripe_price_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      tokens_used INTEGER DEFAULT 0,
      period TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, type, period)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage_records(user_id, period);

    -- Developer platform API keys (P1 feature). The raw key is NEVER
    -- stored — only its SHA-256 hash. The raw key is returned to the
    -- caller exactly ONCE at creation time and is unrecoverable after.
    -- key_prefix stores the first 12 chars (qaesitor_.... style)
    -- so the listing UI can identify which key is which without
    -- exposing the secret.
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL,
      last_used_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      expires_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
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
    logger.warn(
      { module: "db", err: err instanceof Error ? err.message : String(err) },
      "SQLite failed, falling back to in-memory"
    );
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
export async function getPrismaDb(): Promise<PrismaClient | null> {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("postgresql://")) return null;
  try {
    const prisma = await getPrisma();
    if (!prisma) return null;
    activeDbType = "postgres";
    return prisma;
  } catch (err) {
    logger.warn(
      { module: "db", err: err instanceof Error ? err.message : String(err) },
      "Postgres failed, falling back to SQLite"
    );
    return null;
  }
}

// Check if Postgres is configured.
export function isPostgresAvailable(): boolean {
  return (process.env.DATABASE_URL || "").startsWith("postgresql://");
}
