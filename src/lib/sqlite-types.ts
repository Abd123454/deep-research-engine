// Type definitions for raw better-sqlite3 query results.
//
// Maintenance: when a CREATE TABLE in db.ts or any route's db.exec(...)
// changes, update the matching *Row interface here. Drift is caught by
// tsc --noEmit only when consumers access a field that doesn't exist.

// ---------- Core schema (defined in db.ts initSqliteSchema) ----------

export interface SessionRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  content: string | null;
  metadata: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  model_used: string | null;
  created_at: string;
}

export interface LongTermMemoryRow {
  id: string;
  user_id: string;
  type: string;
  content: string;
  confidence: number | null;
  created_at: string;
  last_accessed: string | null;
  access_count: number | null;
}

export interface ResearchJobRow {
  id: string;
  user_id: string;
  query: string;
  plan: string | null;
  report: string | null;
  sources: string | null;
  stats: string | null;
  verification_report: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  size: number;
  text: string;
  text_length: number;
  created_at: string;
}

export interface UserPreferenceRow {
  user_id: string;
  preferred_language: string | null;
  preferred_depth: string | null;
  preferred_format: string | null;
  preferred_provider: string | null;
  timezone: string | null;
}

// ---------- Auxiliary schema (lazily created in route handlers) ----------

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorRow {
  id: string;
  project_id: string;
  type: string;
  credentials: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  created_at?: string;
  updated_at?: string;
}

// ---------- Composite rows (JOINs / computed columns) ----------

/** SELECT c.*, (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count */
export interface ConversationWithCountRow extends ConversationRow {
  msg_count: number;
}

/** Raw $queryRaw result from pgvector cosine similarity search. */
export interface RawVectorSearchRow {
  id: string;
  type: string;
  content: string;
  confidence: number;
  created_at: Date | string;
  last_accessed: Date | string | null;
  access_count: number;
  similarity: number;
}
