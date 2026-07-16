-- Quaesitor — Initial migration
-- This migration creates all tables for the 5-layer memory system.
-- For SQLite, these tables are also created by initSqliteSchema() in db.ts.
-- For Postgres, this migration is the source of truth.

-- Users
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Projects
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_projects_userId" ON "projects"("userId");

-- Connectors
CREATE TABLE IF NOT EXISTS "connectors" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "credentials" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_connectors_projectId" ON "connectors"("projectId");

-- Conversations
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_conversations_userId" ON "conversations"("userId");

-- Messages
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_messages_conversationId" ON "messages"("conversationId");

-- Long-term memories
CREATE TABLE IF NOT EXISTS "long_term_memories" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessed" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_memories_userId" ON "long_term_memories"("userId");

-- Research jobs
CREATE TABLE IF NOT EXISTS "research_jobs" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "query" TEXT NOT NULL,
    "plan" JSONB,
    "report" TEXT,
    "sources" JSONB,
    "stats" JSONB,
    "verificationReport" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_research_userId" ON "research_jobs"("userId");
CREATE INDEX IF NOT EXISTS "idx_research_status" ON "research_jobs"("status");

-- Documents
CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_documents_userId" ON "documents"("userId");

-- User preferences
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "userId" TEXT PRIMARY KEY,
    "preferredLanguage" TEXT DEFAULT 'auto',
    "preferredDepth" TEXT DEFAULT 'standard',
    "preferredFormat" TEXT DEFAULT 'markdown',
    "preferredProvider" TEXT DEFAULT 'auto',
    "timezone" TEXT,
    FOREIGN KEY ("userId") REFERENCES "users"("id")
);
