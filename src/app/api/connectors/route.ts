// GET  /api/connectors — list connectors for a project.
// POST /api/connectors — add a connector to a project.
//
// SECURITY: credentials are encrypted at rest with AES-256-GCM before
// being written to the DB. They are NEVER returned in plaintext over the
// API — the GET / POST responses use `maskCredentials()` so the client
// only ever sees `••••` + the last 4 characters (enough to identify
// which token is stored, not enough to use it). Legacy plaintext
// payloads in the DB are tolerated on read (backward compatibility)
// and re-encrypted on the next write.
//
// SECURITY (V5 audit fix): GET / POST verify that the caller owns the
// target project before listing or creating connectors. The connector
// query is also scoped via a JOIN on `projects.user_id` as
// defense-in-depth — even if the ownership check were bypassed, the
// query itself would refuse to return rows for another user's project.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ConnectorRow } from "@/lib/sqlite-types";
import {
  encryptCredentials,
  decryptCredentials,
  maskCredentials,
} from "@/lib/credentials";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

/**
 * Build the safe connector response object — credentials are decrypted
 * (so we can confirm the stored payload is valid) and then masked
 * before being returned. The plaintext never crosses the wire.
 *
 * `hasCredentials` is a separate boolean so the UI can distinguish
 * "no credentials stored" from "credentials stored but masked" without
 * having to inspect the masked values.
 */
function toResponseConnector(row: {
  id: string;
  projectId: string;
  type: string;
  credentials: string | null;
  createdAt: string | Date;
}) {
  const decrypted = decryptCredentials<Record<string, string> | null>(row.credentials);
  const hasCredentials = !!decrypted && Object.keys(decrypted).length > 0;
  const masked = hasCredentials
    ? maskCredentials(decrypted as Record<string, string>)
    : {};
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    // V1 audit fix: never return plaintext credentials. The masked form
    // ("••••" + last4) lets the UI identify which token is stored without
    // exposing the secret.
    credentials: masked,
    hasCredentials,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
  };
}

/**
 * Verify that the given projectId belongs to the caller. Returns null
 * when ownership is confirmed, or a 404 NextResponse when the project
 * is missing or belongs to another user.
 *
 * V5 audit fix: prevents `GET /api/connectors?projectId=<someone-else's-id>`
 * from listing another user's decrypted (now masked) credentials, and
 * prevents POST from creating a connector on someone else's project.
 */
async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<NextResponse | null> {
  // Postgres path.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { userId: true },
        });
        if (!project || project.userId !== userId) {
          return NextResponse.json(
            { ok: false, error: "Project not found." },
            { status: 404 }
          );
        }
        return null;
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
      // P0-10: log a sanitized error message — Postgres connection
      // errors can include the connection URL with embedded
      // credentials. The full error is still sent to Sentry for
      // debugging; this local log line is the secret-free form.
      logger.warn(
        { module: "connectors", projectId, err: sanitizeError(err) },
        "verifyProjectOwnership Postgres lookup failed — falling through to SQLite"
      );
}
  }

  // SQLite path.
  try {
    const db = getDb();
    const project = db
      .prepare("SELECT user_id FROM projects WHERE id = ?")
      .get(projectId) as { user_id?: string } | undefined;
    if (!project || project.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: "Project not found." },
        { status: 404 }
      );
    }
    return null;
  } catch {
    // If we can't even check ownership, fail-closed.
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  // Auth: connectors expose (masked) third-party credentials, so even
  // GET requires authentication (no anonymous listing).
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  // V5 audit fix: verify the caller owns the target project BEFORE
  // querying connectors. A 404 (not a 403) is returned so we don't leak
  // the existence of someone else's project IDs.
  const ownershipFail = await verifyProjectOwnership(projectId, userId);
  if (ownershipFail) return ownershipFail;

  // SENSITIVE ACTION: reading connector credentials. Logged at the start
  // so even a failed read is recorded.
  logSensitiveAction("connector.credentials_access", userId, req, {
    projectId,
    phase: "list_initiated",
  });

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // V5 defense-in-depth: scope the query via the project relation
        // so even if the ownership check were bypassed, the DB would
        // refuse to return another user's connectors.
        const connectors = await prisma.connector.findMany({
          where: { projectId, project: { userId } },
        });
        return NextResponse.json({
          ok: true,
          connectors: connectors.map((c) =>
            toResponseConnector({
              id: c.id,
              projectId: c.projectId,
              type: c.type,
              credentials: c.credentials,
              createdAt: c.createdAt,
            })
          ),
        });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
      // P0-10: log a sanitized error message — Postgres connection
      // errors can include the connection URL with embedded
      // credentials. The full error is still sent to Sentry for
      // debugging; this local log line is the secret-free form.
      logger.warn(
        { module: "connectors", projectId, err: sanitizeError(err) },
        "verifyProjectOwnership Postgres lookup failed — falling through to SQLite"
      );
}
  }
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
      credentials TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    // V5 defense-in-depth: JOIN on projects.user_id so the DB itself
    // enforces the per-user scoping. The `projectId` is parameter-bound
    // (no SQL injection surface).
    const rows = db
      .prepare(
        `SELECT c.* FROM connectors c
         JOIN projects p ON c.project_id = p.id
         WHERE c.project_id = ? AND p.user_id = ?`
      )
      .all(projectId, userId) as ConnectorRow[];
    return NextResponse.json({
      ok: true,
      connectors: rows.map((r) =>
        toResponseConnector({
          id: r.id,
          projectId: r.project_id,
          type: r.type,
          credentials: r.credentials,
          createdAt: r.created_at,
        })
      ),
    });
  } catch {
    return NextResponse.json({ ok: true, connectors: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, type, credentials } = body;
    if (!projectId || !type) {
      return NextResponse.json({ ok: false, error: "projectId and type are required." }, { status: 400 });
    }

    // Auth: connector creation writes encrypted third-party credentials.
    const authFail = requireAuth(req);
    if (authFail) return authFail;
    const userId = getUserId(req);

    // V5 audit fix: verify the caller owns the target project before
    // allowing a connector to be created against it. Without this check,
    // any authenticated user could attach a connector (with attacker-
    // controlled credentials) to another user's project, then read it
    // back via GET.
    const ownershipFail = await verifyProjectOwnership(projectId, userId);
    if (ownershipFail) return ownershipFail;

    // SENSITIVE ACTION: connector creation (stores third-party creds).
    logSensitiveAction("connector.create", userId, req, {
      projectId,
      connectorType: type,
      phase: "initiated",
    });

    const id = crypto.randomUUID();
    // Encrypt credentials at rest. Accept either a string (treated as a
    // JSON-encoded blob) or an object. The encrypted payload is what
    // gets stored — never the plaintext.
    const credsToStore =
      typeof credentials === "string" && credentials.length > 0
        ? encryptCredentials(credentials)
        : encryptCredentials(credentials ?? {});

    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          const connector = await prisma.connector.create({
            data: { id, projectId, type, credentials: credsToStore },
          });
          return NextResponse.json({
            ok: true,
            connector: toResponseConnector({
              id: connector.id,
              projectId: connector.projectId,
              type: connector.type,
              credentials: connector.credentials,
              createdAt: connector.createdAt,
            }),
          });
        }
      } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
      // P0-10: log a sanitized error message — Postgres connection
      // errors can include the connection URL with embedded
      // credentials. The full error is still sent to Sentry for
      // debugging; this local log line is the secret-free form.
      logger.warn(
        { module: "connectors", projectId, err: sanitizeError(err) },
        "verifyProjectOwnership Postgres lookup failed — falling through to SQLite"
      );
}
    }
    try {
      const db = getDb();
      db.exec(`CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
        credentials TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.prepare("INSERT INTO connectors (id, project_id, type, credentials) VALUES (?, ?, ?, ?)").run(id, projectId, type, credsToStore);
      return NextResponse.json({
        ok: true,
        connector: toResponseConnector({
          id,
          projectId,
          type,
          credentials: credsToStore,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch {
      return NextResponse.json({ ok: false, error: "Failed to create connector." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
