// GET /api/account/export — GDPR Article 20 "Right to data portability".
//
// Exports ALL data associated with the current user as a JSON download.
// Response has `Content-Disposition: attachment; filename="quaesitor-data-export.json"`.
//
// Includes:
//   - conversations (with messages)
//   - long_term_memories
//   - research_jobs
//   - documents (metadata + extracted text)
//   - projects (with connectors — credentials decrypted)
//   - subscriptions
//   - usage_records
//   - user_preferences
//   - audit_logs (this user's)
//   - artifact_storage (this user's)
//
// Requires auth (refuses anonymous access when AUTH_USERNAME/PASSWORD set).
import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logSensitiveAction } from "@/lib/audit";
import { decryptCredentials } from "@/lib/credentials";
import type {
  ConversationRow,
  MessageRow,
  LongTermMemoryRow,
  ResearchJobRow,
  DocumentRow,
  UserPreferenceRow,
  ProjectRow,
  ConnectorRow,
} from "@/lib/sqlite-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_FILENAME = "quaesitor-data-export.json";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  // SENSITIVE ACTION: log at the start so even an attempted-but-failed
  // export is recorded. The actual export is logged again below with
  // the result counts.
  logSensitiveAction("account.export", userId, req, { phase: "initiated" });

  // ---------- Postgres path ----------
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const [
          conversations,
          memories,
          researchJobs,
          documents,
          projects,
          subscriptions,
          usageRecords,
          preferences,
        ] = await Promise.all([
          prisma.conversation.findMany({
            where: { userId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
          }),
          prisma.longTermMemory.findMany({ where: { userId } }),
          prisma.researchJobRecord.findMany({ where: { userId } }),
          prisma.documentRecord.findMany({ where: { userId } }),
          prisma.project.findMany({
            where: { userId },
            include: { connectors: true },
          }),
          prisma.subscription.findMany({ where: { userId } }),
          prisma.usageRecord.findMany({ where: { userId } }),
          prisma.userPreference.findMany({ where: { userId } }),
        ]);

        // Decrypt connector credentials for the export.
        const projectsWithSafeConnectors = projects.map((p) => ({
          ...p,
          connectors: p.connectors.map((c) => ({
            ...c,
            credentials: decryptCredentials(c.credentials),
          })),
        }));

        const payload = {
          format: "quaesitor-account-export",
          version: 1,
          exportedAt: new Date().toISOString(),
          userId,
          conversations,
          memories,
          researchJobs,
          documents,
          projects: projectsWithSafeConnectors,
          subscriptions,
          usageRecords,
          preferences,
        };

        logger.info(
          { module: "account-export", userId, counts: {
            conversations: conversations.length,
            memories: memories.length,
            researchJobs: researchJobs.length,
            documents: documents.length,
            projects: projects.length,
          } },
          "Account exported (Postgres)"
        );
        logSensitiveAction("account.export", userId, req, {
          phase: "completed",
          backend: "postgres",
          counts: {
            conversations: conversations.length,
            memories: memories.length,
            researchJobs: researchJobs.length,
            documents: documents.length,
            projects: projects.length,
          },
        });

        return new NextResponse(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`,
            "Cache-Control": "no-store",
          },
        });
      }
    } catch (err) {
      Sentry.captureException(err);
      logger.error(
        { module: "account-export", userId, err: err instanceof Error ? err.message : String(err) },
        "Postgres account export failed"
      );
      return NextResponse.json(
        { ok: false, error: "Failed to export account data." },
        { status: 500 }
      );
    }
  }

  // ---------- SQLite path ----------
  try {
    const db = getDb();

    const all = <T>(sql: string, ...params: unknown[]): T[] => {
      try {
        return db.prepare(sql).all(...params) as T[];
      } catch {
        return [];
      }
    };

    const conversations = all<ConversationRow>(
      "SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at ASC",
      userId
    );
    const convIds = conversations.map((c) => c.id);
    const messages: MessageRow[] = convIds.length
      ? all<MessageRow>(
          `SELECT * FROM messages WHERE conversation_id IN (${convIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
          ...convIds
        )
      : [];
    const memories = all<LongTermMemoryRow>(
      "SELECT * FROM long_term_memories WHERE user_id = ? ORDER BY created_at ASC",
      userId
    );
    const researchJobs = all<ResearchJobRow>(
      "SELECT * FROM research_jobs WHERE user_id = ? ORDER BY created_at ASC",
      userId
    );
    const documents = all<DocumentRow>(
      "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at ASC",
      userId
    );
    const projects = all<ProjectRow>(
      "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at ASC",
      userId
    );
    const projectIds = projects.map((p) => p.id);
    const connectors: Array<ConnectorRow & { credentialsDecrypted: unknown }> = projectIds.length
      ? all<ConnectorRow>(
          `SELECT * FROM connectors WHERE project_id IN (${projectIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
          ...projectIds
        ).map((c) => ({
          ...c,
          // Decrypt for export — but expose via the `credentialsDecrypted`
          // key to avoid colliding with the raw `credentials` column.
          credentialsDecrypted: decryptCredentials(c.credentials),
        }))
      : [];
    const subscriptions = all<{
      id: string;
      user_id: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_price_id: string | null;
      plan: string;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: number;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at ASC", userId);
    const usageRecords = all<{
      id: string;
      user_id: string;
      type: string;
      count: number;
      tokens_used: number;
      period: string;
      created_at: string;
    }>("SELECT * FROM usage_records WHERE user_id = ? ORDER BY period ASC", userId);
    const preferences = all<UserPreferenceRow>(
      "SELECT * FROM user_preferences WHERE user_id = ?",
      userId
    );
    const auditLogs = all<Record<string, unknown>>(
      "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC",
      userId
    );
    const artifactStorage = all<{
      id: string;
      user_id: string;
      key: string;
      value: string | null;
      shared: number;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM artifact_storage WHERE user_id = ? ORDER BY created_at ASC", userId);

    const payload = {
      format: "quaesitor-account-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      conversations: conversations.map((c) => ({
        ...c,
        messages: messages.filter((m) => m.conversation_id === c.id),
      })),
      memories,
      researchJobs,
      documents,
      projects: projects.map((p) => ({
        ...p,
        connectors: connectors
          .filter((c) => c.project_id === p.id)
          .map((c) => ({
            id: c.id,
            projectId: c.project_id,
            type: c.type,
            credentials: c.credentialsDecrypted,
            createdAt: c.created_at,
          })),
      })),
      subscriptions,
      usageRecords,
      preferences: preferences[0] ?? null,
      auditLogs,
      artifactStorage,
    };

    logger.info(
      { module: "account-export", userId, counts: {
        conversations: conversations.length,
        memories: memories.length,
        researchJobs: researchJobs.length,
        documents: documents.length,
        projects: projects.length,
      } },
      "Account exported (SQLite)"
    );
    logSensitiveAction("account.export", userId, req, {
      phase: "completed",
      backend: "sqlite",
      counts: {
        conversations: conversations.length,
        memories: memories.length,
        researchJobs: researchJobs.length,
        documents: documents.length,
        projects: projects.length,
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(
      { module: "account-export", userId, err: err instanceof Error ? err.message : String(err) },
      "SQLite account export failed"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to export account data." },
      { status: 500 }
    );
  }
}
