// GET /api/memory/export — GDPR Article 20 (Right to data portability) for
// the user's long-term memory layer ONLY.
//
// This is the narrower counterpart to /api/account/export (which exports
// the entire account). /api/memory/export is for users who want to download
// JUST their accumulated memories — facts, preferences, context — along
// with the metadata that drives memory recall: confidence, access count,
// last accessed, and (when Postgres+pgvector is configured) the semantic
// embedding vector.
//
// Response:
//   - Content-Type: application/json; charset=utf-8
//   - Content-Disposition: attachment; filename="quaesitor-memory.json"
//   - Cache-Control: no-store
//
// Body shape:
//   {
//     "format": "quaesitor-memory-export",
//     "version": 1,
//     "exportedAt": "2026-…Z",
//     "userId": "…",
//     "memoryCount": 42,
//     "memories": [
//       {
//         "id": "…",
//         "content": "User prefers Arabic responses",
//         "type": "preference",
//         "confidence": 0.92,
//         "createdAt": "2026-…Z",
//         "lastAccessedAt": "2026-…Z" | null,
//         "accessCount": 3,
//         "embedding": [0.0123, …]  // present only when Postgres+pgvector
//       },
//       …
//     ]
//   }
//
// Requires auth (refuses anonymous access when AUTH_USERNAME/PASSWORD set).
import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logSensitiveAction } from "@/lib/audit";
import type { LongTermMemoryRow } from "@/lib/sqlite-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_FILENAME = "quaesitor-memory.json";

// Raw row from the Postgres $queryRaw below. The embedding is selected as
// text (pgvector's ::text cast yields "[0.1,0.2,…]") so we can parse it
// back into a number[] on the server side before returning it to the
// caller.
interface PostgresMemoryRow {
  id: string;
  type: string;
  content: string;
  confidence: number;
  created_at: Date | string;
  last_accessed: Date | string | null;
  access_count: number;
  embedding_text: string | null;
}

interface ExportedMemory {
  id: string;
  content: string;
  type: string;
  confidence: number;
  createdAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  // Present only when the backend stores a semantic embedding for this
  // memory (Postgres + pgvector). Absent for SQLite-only deployments.
  embedding?: number[];
}

/** Parse the pgvector text representation "[0.1,0.2,…]" into a number[].
 * Returns null if the input is null, empty, or doesn't match the expected
 * shape (so a malformed row never aborts the whole export). */
function parseEmbedding(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;
  const inner = trimmed.slice(1, -1);
  if (inner.length === 0) return [];
  const parts = inner.split(",");
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return undefined;
    nums.push(n);
  }
  return nums;
}

function iso(d: Date | string | null): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return d;
}

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  // SENSITIVE ACTION: log the attempt at the start so even a failed
  // export is recorded.
  logSensitiveAction("memory.export", userId, req, { phase: "initiated" });

  // ---------- Postgres path ----------
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // Raw SQL because the `embedding` column is `Unsupported("vector(1536)")`
        // in the Prisma schema — Prisma's typed query builder cannot select
        // it. We cast to ::text so the value crosses the wire as a string,
        // then parse it back to number[] above.
        //
        // SECURITY: userId is parameterized via $queryRaw tagged template
        // (Prisma escapes it safely — never string-interpolate user input
        // into raw SQL).
        const rows = await prisma.$queryRaw<PostgresMemoryRow[]>`
          SELECT
            id,
            type,
            content,
            confidence,
            created_at,
            last_accessed,
            access_count,
            CASE
              WHEN embedding IS NULL THEN NULL
              ELSE embedding::text
            END AS embedding_text
          FROM long_term_memories
          WHERE user_id = ${userId}
          ORDER BY created_at ASC
        `;

        const memories: ExportedMemory[] = rows.map((r) => {
          const emb = parseEmbedding(r.embedding_text);
          const base: ExportedMemory = {
            id: r.id,
            content: r.content,
            type: r.type,
            confidence: r.confidence,
            createdAt: iso(r.created_at) || new Date(0).toISOString(),
            lastAccessedAt: iso(r.last_accessed),
            accessCount: r.access_count || 0,
          };
          if (emb !== undefined) base.embedding = emb;
          return base;
        });

        const payload = {
          format: "quaesitor-memory-export",
          version: 1,
          exportedAt: new Date().toISOString(),
          userId,
          memoryCount: memories.length,
          memories,
        };

        logger.info(
          { module: "memory-export", userId, count: memories.length, backend: "postgres" },
          "Memory exported (Postgres)"
        );
        logSensitiveAction("memory.export", userId, req, {
          phase: "completed",
          backend: "postgres",
          count: memories.length,
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
        { module: "memory-export", userId, err: err instanceof Error ? err.message : String(err) },
        "Postgres memory export failed"
      );
      return NextResponse.json(
        { ok: false, error: "Failed to export memory data." },
        { status: 500 }
      );
    }
  }

  // ---------- SQLite path ----------
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, user_id, type, content, confidence, created_at, last_accessed, access_count " +
          "FROM long_term_memories WHERE user_id = ? ORDER BY created_at ASC"
      )
      .all(userId) as LongTermMemoryRow[];

    const memories: ExportedMemory[] = rows.map((r) => ({
      id: r.id,
      content: r.content,
      type: r.type,
      confidence: r.confidence ?? 0.5,
      createdAt: r.created_at,
      lastAccessedAt: r.last_accessed,
      accessCount: r.access_count ?? 0,
    }));

    const payload = {
      format: "quaesitor-memory-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      memoryCount: memories.length,
      memories,
    };

    logger.info(
      { module: "memory-export", userId, count: memories.length, backend: "sqlite" },
      "Memory exported (SQLite)"
    );
    logSensitiveAction("memory.export", userId, req, {
      phase: "completed",
      backend: "sqlite",
      count: memories.length,
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
      { module: "memory-export", userId, err: err instanceof Error ? err.message : String(err) },
      "SQLite memory export failed"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to export memory data." },
      { status: 500 }
    );
  }
}
