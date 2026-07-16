// GET    /api/projects/[id] — get project details with items.
// PATCH  /api/projects/[id] — update project (name, description).
// DELETE /api/projects/[id] — delete project.

import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ProjectRow } from "@/lib/sqlite-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const project = await prisma.project.findUnique({
          where: { id },
          include: {
            conversations: { orderBy: { createdAt: "desc" }, take: 20 },
            researchJobs: { orderBy: { createdAt: "desc" }, take: 20 },
            documents: { orderBy: { createdAt: "desc" }, take: 20 },
            connectors: true,
          },
        });
        if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
        return NextResponse.json({ ok: true, project });
      }
    } catch { /* fall through */ }
  }
  // SQLite fallback.
  try {
    const db = getDb();
    const proj = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    if (!proj) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project: { ...proj, conversations: [], researchJobs: [], documents: [], connectors: [] } });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const updated = await prisma.project.update({
          where: { id },
          data: { name: body.name, description: body.description },
        });
        return NextResponse.json({ ok: true, project: updated });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    if (body.name) db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(body.name, id);
    if (body.description !== undefined) db.prepare("UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?").run(body.description, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.project.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
