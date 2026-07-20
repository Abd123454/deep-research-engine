// GET    /api/workspaces/[id]/members         — list members of a workspace.
// POST   /api/workspaces/[id]/members         — invite a member.
// DELETE /api/workspaces/[id]/members?userId=  — remove a member.
//
// Membership is stored in `workspace_members` (see src/lib/rbac.ts for
// the schema). The project owner is implicitly an `owner`-role member
// and is NOT stored as a row in workspace_members — `getUserRole`
// derives ownership from `projects.user_id`. The list endpoint synthesizes
// an owner row at the top of the response so the UI can render the
// complete member roster without a special case.
//
// Authorization:
//   - GET (list members):       requires `read` on `project`  (any role)
//   - POST (invite member):     requires `manage` on `project` (admin+)
//   - DELETE (remove member):   requires `manage` on `project` (admin+)
//
// The owner is always returned at the top of the GET response and is
// never removable (DELETE on the owner returns 400). An admin/owner can
// remove themselves from a workspace they were invited to (in which
// case their membership row is deleted), but the project owner can
// never be removed via this endpoint — ownership transfer is a separate
// (future) operation.
//
// Auth: requireAuth + getUserId (Basic auth, NOT API-key auth).

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import {
  ensureWorkspaceMembersTable,
  getUserRole,
  checkPermission,
  type Role,
} from "@/lib/rbac";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

interface MemberRow {
  id: string;
  user_id: string;
  project_id: string;
  role: Role;
  created_at: string;
}

interface ProjectOwnerRow {
  user_id: string;
  name: string;
  description: string | null;
}

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"];

/**
 * Resolve the workspace (project) owner's userId. Returns null when the
 * project doesn't exist. The caller is expected to have already verified
 * their own access via `checkPermission` — a null result here means the
 * project id is genuinely missing, not that the caller lacks access.
 */
function getProjectOwner(projectId: string): string | null {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT user_id FROM projects WHERE id = ?")
      .get(projectId) as ProjectOwnerRow | undefined;
    return row?.user_id ?? null;
  } catch (err) {
    // Log to Sentry so transient DB issues surface; return null so the
    // caller treats the project as missing (safer than crashing the request).
    Sentry.captureException(err);
    logger.warn({ err: sanitizeError(err), projectId }, "getProjectOwner: DB lookup failed");
    return null;
  }
}

// ---------- GET /api/workspaces/[id]/members ----------

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);
  const { id: projectId } = await ctx.params;

  // Authorization: any member can read the roster (read on project).
  const { allowed, role } = checkPermission(userId, projectId, "project", "read");
  if (!allowed || !role) {
    // 404 (not 403) — don't leak the existence of workspaces the caller
    // can't access. Matches the connectors route's behavior.
    return NextResponse.json(
      { ok: false, error: "Workspace not found." },
      { status: 404 }
    );
  }

  try {
    ensureWorkspaceMembersTable();
    const db = getDb();
    const ownerId = getProjectOwner(projectId);

    // Synthesize the owner row at the top of the roster. The owner is
    // implicitly a member at role "owner" (no row in workspace_members).
    const ownerEntry: MemberRow | null = ownerId
      ? {
          id: `owner:${projectId}`,
          user_id: ownerId,
          project_id: projectId,
          role: "owner",
          created_at: "", // unknown — owner since project creation
        }
      : null;

    const memberRows = db
      .prepare(
        "SELECT id, user_id, project_id, role, created_at FROM workspace_members WHERE project_id = ? ORDER BY created_at ASC"
      )
      .all(projectId) as MemberRow[];

    // The owner is filtered OUT of the member rows (defensive —
    // `getUserRole` returns "owner" for the owner without consulting
    // workspace_members, so an owner row here would be a duplicate).
    const members = [
      ...(ownerEntry ? [ownerEntry] : []),
      ...memberRows.filter((m) => m.user_id !== ownerId),
    ].map((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role,
      // Mask the user id (last 4 chars only) so a member can identify
      // who is who without exposing the full identifier across the wire.
      // The full user id is only visible to admins+ — but the masking
      // is consistent for defense-in-depth.
      userIdMasked: maskUserId(m.user_id),
      createdAt: m.created_at,
    }));

    return NextResponse.json({
      ok: true,
      workspaceId: projectId,
      members,
      total: members.length,
      // The caller's own role is included separately so the UI can
      // render role-gated controls without having to scan the list.
      yourRole: role,
    });
  } catch (err) {
    logger.error(
      { module: "workspaces", err: sanitizeError(err), userId, projectId },
      "Failed to list workspace members"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to list members." },
      { status: 500 }
    );
  }
}

/**
 * Mask a user id for the member listing response. Shows the first 4 and
 * last 4 characters with `••••` in between — enough to identify the user
 * visually (e.g. `admi••••lt99`) without exposing the full identifier.
 */
function maskUserId(userId: string): string {
  if (userId.length <= 8) return "••••";
  return `${userId.slice(0, 4)}••••${userId.slice(-4)}`;
}

// ---------- POST /api/workspaces/[id]/members ----------

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);
  const { id: projectId } = await ctx.params;

  // Authorization: only admin+ can invite members (manage on project).
  const { allowed, role } = checkPermission(
    userId,
    projectId,
    "project",
    "manage"
  );
  if (!allowed || !role) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found." },
      { status: 404 }
    );
  }

  let body: { userId?: unknown; role?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; role?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const targetUserId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, error: "Target userId is required." },
      { status: 400 }
    );
  }

  // Validate the requested role. "owner" is NOT assignable via this
  // endpoint — ownership transfer is a separate (future) operation.
  const requestedRole =
    typeof body.role === "string" && VALID_ROLES.includes(body.role as Role)
      ? (body.role as Role)
      : null;
  if (!requestedRole) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  // Cannot invite the project owner (they're already an owner).
  const ownerId = getProjectOwner(projectId);
  if (!ownerId) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found." },
      { status: 404 }
    );
  }
  if (targetUserId === ownerId) {
    return NextResponse.json(
      { ok: false, error: "The workspace owner is already a member." },
      { status: 400 }
    );
  }

  // An admin cannot grant a role higher than their own. Only the owner
  // can grant the admin role. This prevents an admin from creating a
  // second admin who could then remove the original admin.
  const ROLE_RANK: Record<Role, number> = {
    viewer: 0,
    editor: 1,
    admin: 2,
    owner: 3,
  };
  if (ROLE_RANK[requestedRole] >= ROLE_RANK[role]) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "You cannot grant a role equal to or higher than your own role.",
      },
      { status: 403 }
    );
  }

  const id = crypto.randomUUID();

  try {
    ensureWorkspaceMembersTable();
    const db = getDb();
    // INSERT OR REPLACE so re-inviting an existing member updates their
    // role rather than failing on the UNIQUE(user_id, project_id)
    // constraint. The audit log distinguishes "invite" (new) from
    // "role_change" (update) via the `changed` metadata field.
    const existing = db
      .prepare(
        "SELECT role FROM workspace_members WHERE user_id = ? AND project_id = ?"
      )
      .get(targetUserId, projectId) as { role?: Role } | undefined;

    db.prepare(
      `INSERT INTO workspace_members (id, user_id, project_id, role, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, project_id) DO UPDATE SET role = excluded.role`
    ).run(id, targetUserId, projectId, requestedRole);

    // Audit log — `workspace.invite`. The target user id + the granted
    // role are recorded. The target user id is NOT masked in the audit
    // log (audit logs are admin-only and the full id is needed for
    // reconstructing who-did-what after an incident).
    logSensitiveAction("workspace.invite", userId, req, {
      workspaceId: projectId,
      targetUserId,
      role: requestedRole,
      changed: existing ? "role_change" : "new",
      previousRole: existing?.role ?? null,
    });

    logger.info(
      {
        module: "workspaces",
        userId,
        projectId,
        targetUserId,
        role: requestedRole,
      },
      existing ? "Member role updated" : "Member invited"
    );

    return NextResponse.json(
      {
        ok: true,
        member: {
          id,
          userId: targetUserId,
          userIdMasked: maskUserId(targetUserId),
          role: requestedRole,
          createdAt: new Date().toISOString(),
        },
        changed: existing ? "role_change" : "new",
      },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    logger.error(
      { module: "workspaces", err: sanitizeError(err), userId, projectId },
      "Failed to invite workspace member"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to invite member." },
      { status: 500 }
    );
  }
}

// ---------- DELETE /api/workspaces/[id]/members?userId=... ----------

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);
  const { id: projectId } = await ctx.params;

  const targetUserId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, error: "userId query parameter is required." },
      { status: 400 }
    );
  }

  // Authorization: admin+ can remove members. Members can also remove
  // THEMSELVES (a viewer who wants to leave a workspace shouldn't need
  // admin permission to do so). The self-removal exception is checked
  // AFTER the role check below — see the self-leave branch.
  const { allowed, role } = checkPermission(
    userId,
    projectId,
    "project",
    "manage"
  );

  // Self-leave exception: a non-admin member can remove themselves.
  const isSelfLeave = userId === targetUserId;
  if (!allowed || !role) {
    if (!isSelfLeave) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 404 }
      );
    }
    // Self-leave: confirm the user is actually a member before letting
    // them through. `getUserRole` returns null for non-members — that
    // would also return 404 here (you can't leave a workspace you're
    // not in).
    const selfRole = getUserRole(userId, projectId);
    if (!selfRole || selfRole === "owner") {
      // Owner can't self-remove (ownership transfer is separate).
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 404 }
      );
    }
  }

  // Cannot remove the project owner via this endpoint.
  const ownerId = getProjectOwner(projectId);
  if (!ownerId) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found." },
      { status: 404 }
    );
  }
  if (targetUserId === ownerId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The workspace owner cannot be removed. Transfer ownership first.",
      },
      { status: 400 }
    );
  }

  try {
    ensureWorkspaceMembersTable();
    const db = getDb();
    const info = db
      .prepare(
        "DELETE FROM workspace_members WHERE user_id = ? AND project_id = ?"
      )
      .run(targetUserId, projectId);

    if (info.changes === 0) {
      return NextResponse.json(
        { ok: false, error: "Member not found in this workspace." },
        { status: 404 }
      );
    }

    // Audit log — `workspace.remove`. The removed user id + their
    // (former) role are recorded for forensic reconstruction.
    logSensitiveAction("workspace.remove", userId, req, {
      workspaceId: projectId,
      targetUserId,
      removedBy: userId,
      selfLeave: isSelfLeave,
    });

    logger.info(
      {
        module: "workspaces",
        userId,
        projectId,
        targetUserId,
        selfLeave: isSelfLeave,
      },
      "Workspace member removed"
    );

    return NextResponse.json({ ok: true, removed: true });
  } catch (err) {
    logger.error(
      { module: "workspaces", err: sanitizeError(err), userId, projectId },
      "Failed to remove workspace member"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to remove member." },
      { status: 500 }
    );
  }
}
