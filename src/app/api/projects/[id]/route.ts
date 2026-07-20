// GET    /api/projects/[id] — get project details with items.
// PATCH  /api/projects/[id] — update project (name, description).
// DELETE /api/projects/[id] — delete project.
//
// SECURITY (skills-audit): all three handlers now enforce:
//   1. requireAuth(req) — rejects anonymous callers when auth is configured.
//   2. Per-user ownership check — a 404 (NOT 403) is returned when the
//      requested project belongs to a different user. A 404 leaks no
//      information about the existence of other users' project IDs.
//   3. Connector credentials are returned MASKED, never in plaintext —
//      mirrors the pattern in /api/connectors/route.ts (uses
//      `maskCredentials(decryptCredentials(...) ?? {})`). Previously
//      the GET handler returned `decryptCredentials(...)` verbatim,
//      leaking plaintext third-party tokens to ANY caller (including
//      unauthenticated ones, since auth was missing too).
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { ProjectRow } from "@/lib/sqlite-types";
import { decryptCredentials, maskCredentials } from "@/lib/credentials";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";

/**
 * Verify the caller owns the project. Returns `null` on success,
 * or a 404 NextResponse when the project is missing or belongs to
 * another user (404 — not 403 — so we don't leak the existence of
 * other users' project IDs).
 */
async function verifyProjectOwnership(
  id: string,
  userId: string
): Promise<NextResponse | null> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const project = await prisma.project.findUnique({
          where: { id },
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
      // Fall through to SQLite check.
    }
  }
  try {
    const db = getDb();
    const project = db
      .prepare("SELECT user_id FROM projects WHERE id = ?")
      .get(id) as { user_id?: string } | undefined;
    if (!project || project.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: "Project not found." },
        { status: 404 }
      );
    }
    return null;
  } catch {
    // Fail-closed when we can't even verify ownership.
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { id } = await params;
  const ownershipFail = await verifyProjectOwnership(id, userId);
  if (ownershipFail) return ownershipFail;

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
        // SECURITY: mask connector credentials — NEVER return plaintext
        // third-party tokens over the API. See /api/connectors/route.ts
        // for the same pattern. Plaintext never crosses the wire.
        const projectWithSafeConnectors = {
          ...project,
          connectors: project.connectors.map((c) => {
            const decrypted = decryptCredentials<Record<string, string> | null>(
              c.credentials
            );
            const hasCredentials =
              !!decrypted && Object.keys(decrypted).length > 0;
            return {
              ...c,
              credentials: hasCredentials
                ? maskCredentials(decrypted as Record<string, string>)
                : {},
              hasCredentials,
            };
          }),
        };
        return NextResponse.json({ ok: true, project: projectWithSafeConnectors });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */
}
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
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { id } = await params;
  const ownershipFail = await verifyProjectOwnership(id, userId);
  if (ownershipFail) return ownershipFail;

  const body = await req.json().catch(() => ({}));
  logSensitiveAction("project.update", userId, req, { projectId: id });

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
    } catch (err) {
  Sentry.captureException(err);
/* fall through */
}
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { id } = await params;
  const ownershipFail = await verifyProjectOwnership(id, userId);
  if (ownershipFail) return ownershipFail;

  logSensitiveAction("project.delete", userId, req, { projectId: id });

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.project.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
    } catch (err) {
  Sentry.captureException(err);
/* fall through */
}
  }
  try {
    const db = getDb();
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
