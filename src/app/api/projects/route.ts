// GET  /api/projects — list user's projects.
// POST /api/projects — create a new project.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ProjectRow } from "@/lib/sqlite-types";
import { requireAuth } from "@/lib/auth";

const DEFAULT_USER_ID = "default";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const projects = await prisma.project.findMany({
          where: { userId: DEFAULT_USER_ID },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: {
              select: { conversations: true, researchJobs: true, documents: true },
            },
          },
        });
        return NextResponse.json({ ok: true, projects: projects.map((p) => ({
          ...p,
          createdAt: p.createdAt?.toISOString?.() || String(p.createdAt),
          updatedAt: p.updatedAt?.toISOString?.() || String(p.updatedAt),
        })) });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  // SQLite fallback.
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const rows = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(DEFAULT_USER_ID) as ProjectRow[];
    return NextResponse.json({ ok: true, projects: rows.map((r) => ({
      id: r.id, userId: r.user_id, name: r.name, description: r.description,
      createdAt: r.created_at, updatedAt: r.updated_at,
      _count: { conversations: 0, researchJobs: 0, documents: 0 },
    })) });
  } catch {
    return NextResponse.json({ ok: true, projects: [] });
  }
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Project name is required." }, { status: 400 });
    }
    const description = body.description || null;
    const id = crypto.randomUUID();

    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          const project = await prisma.project.create({
            data: { id, userId: DEFAULT_USER_ID, name, description },
          });
          return NextResponse.json({ ok: true, project: { ...project, createdAt: project.createdAt?.toISOString?.(), updatedAt: project.updatedAt?.toISOString?.() } });
        }
      } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
    }
    // SQLite fallback.
    try {
      const db = getDb();
      db.exec(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.prepare("INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)").run(id, DEFAULT_USER_ID, name, description);
      return NextResponse.json({ ok: true, project: { id, userId: DEFAULT_USER_ID, name, description, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    } catch {
      return NextResponse.json({ ok: false, error: "Failed to create project." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
