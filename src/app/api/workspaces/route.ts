// GET  /api/workspaces — list the caller's workspaces.
// POST /api/workspaces — create a new workspace (project).
//
// A "workspace" in Quaesitor's RBAC model IS a project. The projects
// table is the canonical record; workspace_members adds non-owner
// collaborators at a chosen role (admin / editor / viewer). The project
// creator is implicitly the owner (see `getUserRole` in src/lib/rbac.ts).
//
// GET returns the caller's workspaces: projects they own PLUS projects
// they were invited to via workspace_members. Each entry includes the
// caller's role so the UI can render role-gated controls.
//
// POST creates a new project owned by the caller and audit-logs the
// `workspace.create` sensitive action. The caller is automatically an
// owner — no self-membership row is written (ownership is derived from
// `projects.user_id`).
//
// Auth: requireAuth + getUserId (Basic auth, NOT API-key auth). The
// workspace routes are part of the dashboard UI; API-key auth is
// reserved for the /api/v1/* public-API namespace.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { ensureWorkspaceMembersTable, type Role } from "@/lib/rbac";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Build the safe workspace response object — never exposes `user_id`
 * directly (the caller already knows their own id), but DOES include
 * the resolved `role` so the UI can render role-gated controls.
 */
function toWorkspaceResponse(
  project: ProjectRow,
  role: Role
): {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    role,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

// ---------- GET /api/workspaces ----------

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  try {
    ensureWorkspaceMembersTable();
    const db = getDb();

    // Projects the caller OWNS (role: "owner" — implicit, no membership
    // row needed). This is the common case in single-tenant deployments.
    const owned = db
      .prepare(
        "SELECT id, user_id, name, description, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
      )
      .all(userId) as ProjectRow[];

    // Projects the caller was INVITED to (role from workspace_members).
    // We JOIN against projects so the response includes name/description
    // etc., not just the membership row.
    const invited = db
      .prepare(
        `SELECT p.id, p.user_id, p.name, p.description, p.created_at, p.updated_at,
                wm.role, wm.created_at AS member_since
         FROM workspace_members wm
         JOIN projects p ON wm.project_id = p.id
         WHERE wm.user_id = ?
         ORDER BY p.updated_at DESC`
      )
      .all(userId) as (ProjectRow & { role: Role; member_since: string })[];

    const workspaces = [
      ...owned.map((p) => toWorkspaceResponse(p, "owner" as Role)),
      ...invited.map((r) => toWorkspaceResponse(r, r.role)),
    ];

    return NextResponse.json({ ok: true, workspaces, total: workspaces.length });
  } catch (err) {
    logger.error(
      { module: "workspaces", err: sanitizeError(err), userId },
      "Failed to list workspaces"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to list workspaces." },
      { status: 500 }
    );
  }
}

// ---------- POST /api/workspaces ----------

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: { name?: unknown; description?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; description?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Workspace name is required." },
      { status: 400 }
    );
  }
  if (name.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Workspace name must be 200 characters or fewer." },
      { status: 400 }
    );
  }
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 2000)
      : null;

  const id = crypto.randomUUID();

  try {
    ensureWorkspaceMembersTable();
    const db = getDb();
    // Ensure the projects table exists (defensive — it's also created
    // eagerly by initSqliteSchema in src/lib/db.ts).
    db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.prepare(
      "INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)"
    ).run(id, userId, name, description);

    // Audit log — `workspace.create`. The project id + name are recorded
    // so the audit trail identifies WHICH workspace was created. No
    // self-membership row is written — the caller is implicitly the
    // owner (see `getUserRole` in src/lib/rbac.ts).
    logSensitiveAction("workspace.create", userId, req, {
      workspaceId: id,
      name,
      role: "owner",
    });

    logger.info(
      { module: "workspaces", userId, workspaceId: id, name },
      "Workspace created"
    );

    return NextResponse.json(
      {
        ok: true,
        workspace: {
          id,
          name,
          description,
          role: "owner" as Role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error(
      { module: "workspaces", err: sanitizeError(err), userId },
      "Failed to create workspace"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to create workspace." },
      { status: 500 }
    );
  }
}
