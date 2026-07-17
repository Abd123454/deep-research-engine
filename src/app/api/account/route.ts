// DELETE /api/account — GDPR Article 17 "Right to erasure".
//
// Deletes ALL data associated with the current user:
//   - conversations (+ messages via cascade)
//   - long_term_memories
//   - research_jobs
//   - documents
//   - projects (+ connectors via cascade)
//   - subscriptions
//   - usage_records
//   - user_preferences
//   - audit_logs (this user's)
//   - artifact_storage (this user's)
//   - legacy `sessions` table (single-tenant only — has no user_id column)
//
// Requires auth (refuses anonymous access when AUTH_USERNAME/PASSWORD set).
// Returns `{ ok: true, deleted: { sessions, memories, connectors } }`.
//
// NOTE: this is irreversible. Front-end should show a confirmation modal
// before issuing this request.
import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

  let sessions = 0;
  let memories = 0;
  let connectors = 0;
  let conversations = 0;
  let researchJobs = 0;
  let documents = 0;
  let projects = 0;
  let subscriptions = 0;
  let usageRecords = 0;
  let preferences = 0;
  let auditLogs = 0;
  let artifactStorage = 0;

  // ---------- Postgres path ----------
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // Use a transaction so we either delete everything or nothing.
        const result = await prisma.$transaction(async (tx) => {
          // Messages cascade from conversations, but we delete conversations
          // explicitly so we can count them.
          const conv = await tx.conversation.deleteMany({ where: { userId } });
          const mem = await tx.longTermMemory.deleteMany({ where: { userId } });
          const job = await tx.researchJobRecord.deleteMany({ where: { userId } });
          const doc = await tx.documentRecord.deleteMany({ where: { userId } });
          // Connectors cascade from projects — but we count them first so the
          // response is informative.
          const projectConnectors = await tx.connector.count({
            where: { project: { userId } },
          });
          const proj = await tx.project.deleteMany({ where: { userId } });
          const sub = await tx.subscription.deleteMany({ where: { userId } });
          const usage = await tx.usageRecord.deleteMany({ where: { userId } });
          const pref = await tx.userPreference.deleteMany({ where: { userId } });

          return {
            conversations: conv.count,
            memories: mem.count,
            researchJobs: job.count,
            documents: doc.count,
            connectors: projectConnectors,
            projects: proj.count,
            subscriptions: sub.count,
            usageRecords: usage.count,
            preferences: pref.count,
          };
        });

        conversations = result.conversations;
        memories = result.memories;
        researchJobs = result.researchJobs;
        documents = result.documents;
        connectors = result.connectors;
        projects = result.projects;
        subscriptions = result.subscriptions;
        usageRecords = result.usageRecords;
        preferences = result.preferences;
        // In Postgres mode, "sessions" ≡ conversations (no separate sessions table).
        sessions = conversations;
      }
    } catch (err) {
      Sentry.captureException(err);
      logger.error(
        { module: "account-delete", userId, err: err instanceof Error ? err.message : String(err) },
        "Postgres account deletion failed"
      );
      return NextResponse.json(
        { ok: false, error: "Failed to delete account data." },
        { status: 500 }
      );
    }

    // Best-effort: SQLite-side artifacts/audit logs (dev coexistence).
    try {
      const db = getDb();
      try {
        const r = db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(userId);
        auditLogs = r.changes;
      } catch { /* table may not exist */ }
      try {
        const r = db.prepare("DELETE FROM artifact_storage WHERE user_id = ?").run(userId);
        artifactStorage = r.changes;
      } catch { /* table may not exist */ }
    } catch { /* SQLite not available */ }

    logger.info(
      { module: "account-delete", userId, conversations, memories, connectors, researchJobs, documents, projects, subscriptions, usageRecords, preferences, auditLogs, artifactStorage },
      "Account deleted (Postgres)"
    );
    logAudit({
      userId,
      action: "account.delete",
      resource: "account",
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        sessions,
        memories,
        connectors,
        // Extended counts for transparency.
        conversations,
        researchJobs,
        documents,
        projects,
        subscriptions,
        usageRecords,
        preferences,
        auditLogs,
        artifactStorage,
      },
    });
  }

  // ---------- SQLite path ----------
  try {
    const db = getDb();

    // Delete in dependency-safe order. Each delete is wrapped in try/catch
    // so a missing table doesn't abort the whole operation.
    const run = (sql: string, ...params: unknown[]): number => {
      try {
        return db.prepare(sql).run(...params).changes;
      } catch {
        return 0;
      }
    };

    // Messages cascade from conversations (FK ON DELETE CASCADE).
    conversations = run("DELETE FROM conversations WHERE user_id = ?", userId);
    // SQLite has no separate "messages" cleanup — they cascade.
    memories = run("DELETE FROM long_term_memories WHERE user_id = ?", userId);
    researchJobs = run("DELETE FROM research_jobs WHERE user_id = ?", userId);
    documents = run("DELETE FROM documents WHERE user_id = ?", userId);
    // Connectors cascade from projects (FK ON DELETE CASCADE).
    connectors = run(
      "DELETE FROM connectors WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)",
      userId
    );
    projects = run("DELETE FROM projects WHERE user_id = ?", userId);
    subscriptions = run("DELETE FROM subscriptions WHERE user_id = ?", userId);
    usageRecords = run("DELETE FROM usage_records WHERE user_id = ?", userId);
    preferences = run("DELETE FROM user_preferences WHERE user_id = ?", userId);
    auditLogs = run("DELETE FROM audit_logs WHERE user_id = ?", userId);
    artifactStorage = run("DELETE FROM artifact_storage WHERE user_id = ?", userId);

    // Legacy `sessions` table has NO user_id column — it's single-tenant.
    // In single-tenant mode (auth disabled, userId === "default"), we wipe
    // it. In multi-tenant mode, we leave it alone because we can't safely
    // attribute sessions to a user.
    if (userId === "default") {
      try {
        sessions = db.prepare("DELETE FROM sessions").run().changes;
      } catch {
        sessions = 0;
      }
    } else {
      // Multi-tenant SQLite mode is unusual; treat conversations as
      // "sessions" for the response count.
      sessions = conversations;
    }

    logger.info(
      { module: "account-delete", userId, sessions, memories, connectors, conversations, researchJobs, documents, projects, subscriptions, usageRecords, preferences, auditLogs, artifactStorage },
      "Account deleted (SQLite)"
    );
    logAudit({
      userId,
      action: "account.delete",
      resource: "account",
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        sessions,
        memories,
        connectors,
        conversations,
        researchJobs,
        documents,
        projects,
        subscriptions,
        usageRecords,
        preferences,
        auditLogs,
        artifactStorage,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(
      { module: "account-delete", userId, err: err instanceof Error ? err.message : String(err) },
      "SQLite account deletion failed"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to delete account data." },
      { status: 500 }
    );
  }
}
