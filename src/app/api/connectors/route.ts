// GET  /api/connectors — list connectors for a project.
// POST /api/connectors — add a connector to a project.
//
// SECURITY: credentials are encrypted at rest with AES-256-GCM before
// being written to the DB, and decrypted only when read back. Legacy
// plaintext payloads are tolerated on read (backward compatibility)
// and re-encrypted on the next write.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ConnectorRow } from "@/lib/sqlite-types";
import {
  encryptCredentials,
  decryptCredentials,
} from "@/lib/credentials";

/**
 * Build the safe connector response object — credentials are decrypted
 * for the owning client but never logged.
 */
function toResponseConnector(row: {
  id: string;
  projectId: string;
  type: string;
  credentials: string | null;
  createdAt: string | Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    credentials: decryptCredentials(row.credentials),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
  };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const connectors = await prisma.connector.findMany({
          where: { projectId },
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
}
  }
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
      credentials TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const rows = db.prepare("SELECT * FROM connectors WHERE project_id = ?").all(projectId) as ConnectorRow[];
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
