// Session store — persisted sessions via SQLite.
//
// A session represents one completed unit of work:
//   - research: a deep research job (title = query, content = report)
//   - document_qa: a document Q&A interaction (title = filename, content = answer)
//   - quick: a quick chat question (title = question, content = answer)
//
// Research jobs and documents stay in-memory (they're work-in-progress).
// When a job/answer completes, it's saved here so users can view it later.

import { getDb } from "./db";

export type SessionType = "research" | "document_qa" | "quick";

export interface Session {
  id: string;
  type: SessionType;
  title: string;
  summary: string | null;
  content: string | null;
  metadata: string | null; // JSON string
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  type: SessionType;
  title: string;
  summary: string | null;
  status: string;
  createdAt: string;
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    type: row.type as SessionType,
    title: row.title as string,
    summary: (row.summary as string) || null,
    content: (row.content as string) || null,
    metadata: (row.metadata as string) || null,
    status: row.status as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSummary(row: Record<string, unknown>): SessionSummary {
  return {
    id: row.id as string,
    type: row.type as SessionType,
    title: row.title as string,
    summary: (row.summary as string) || null,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}

export function createSession(
  type: SessionType,
  title: string,
  summary: string | null,
  content: string | null,
  metadata: Record<string, unknown> | null,
  status: string = "completed"
): Session {
  const db = getDb();
  const id = crypto.randomUUID();
  const metadataStr = metadata ? JSON.stringify(metadata) : null;
  db.prepare(
    `INSERT INTO sessions (id, type, title, summary, content, metadata, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, type, title, summary, content, metadataStr, status);
  return getSession(id)!;
}

export function getSession(id: string): Session | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSession(row) : null;
}

export function listSessions(limit = 50, offset = 0): SessionSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, type, title, summary, status, created_at
       FROM sessions
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

export function deleteSession(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return result.changes > 0;
}

export function deleteAllSessions(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM sessions").run();
  return result.changes;
}

export function countSessions(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}
