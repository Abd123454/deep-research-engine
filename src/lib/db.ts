// SQLite database client + schema initialization.
//
// Uses better-sqlite3 (synchronous, native, fast). The database file is
// created at ./data/research.db (or the path in DATABASE_URL). The schema
// is auto-created on first use via CREATE TABLE IF NOT EXISTS statements.
//
// This replaces the in-memory store for sessions (Phase D — persistence).
// Research jobs and documents stay in-memory (they're transient work-in-
// progress), but completed sessions are persisted here so users can resume
// after a refresh.

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: Database.Database | null = null;

function getDbPath(): string {
  // Default to ./data/research.db. Allow override via DATABASE_URL.
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("file:")) {
    const p = url.slice(5);
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  }
  // Default path — ensure the data directory exists.
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore — may be read-only env */
    }
  }
  return path.join(dir, "research.db");
}

function initSchema(db: Database.Database): void {
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
  `);
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  try {
    dbInstance = new Database(getDbPath());
    initSchema(dbInstance);
  } catch (err) {
    // If the database can't be opened (e.g. read-only filesystem in a
    // sandbox), fall back to an in-memory database so the app doesn't crash.
    console.warn("[db] Falling back to in-memory database:", err instanceof Error ? err.message : String(err));
    dbInstance = new Database(":memory:");
    initSchema(dbInstance);
  }
  return dbInstance;
}
