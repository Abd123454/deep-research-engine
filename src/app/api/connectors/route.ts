// GET  /api/connectors — list connectors for a project.
// POST /api/connectors — add a connector to a project.

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";

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
        return NextResponse.json({ ok: true, connectors });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
      credentials TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const rows = db.prepare("SELECT * FROM connectors WHERE project_id = ?").all(projectId) as any[];
    return NextResponse.json({ ok: true, connectors: rows.map((r) => ({
      id: r.id, projectId: r.project_id, type: r.type, credentials: r.credentials, createdAt: r.created_at,
    })) });
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
    const credStr = typeof credentials === "string" ? credentials : JSON.stringify(credentials);

    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          const connector = await prisma.connector.create({
            data: { id, projectId, type, credentials: credStr },
          });
          return NextResponse.json({ ok: true, connector });
        }
      } catch { /* fall through */ }
    }
    try {
      const db = getDb();
      db.exec(`CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
        credentials TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.prepare("INSERT INTO connectors (id, project_id, type, credentials) VALUES (?, ?, ?, ?)").run(id, projectId, type, credStr);
      return NextResponse.json({ ok: true, connector: { id, projectId, type, credentials: credStr } });
    } catch {
      return NextResponse.json({ ok: false, error: "Failed to create connector." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
