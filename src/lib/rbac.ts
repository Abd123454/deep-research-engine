// RBAC — Role-Based Access Control for multi-tenant workspaces.
//
// Quaesitor's multi-tenant model is project-scoped: every "workspace" IS
// a project (the `projects` table is the canonical workspace record).
// Membership is tracked in `workspace_members` (created lazily by
// `ensureWorkspaceMembersTable`). The project owner is implicitly an
// `owner`-role member even without a row in `workspace_members` — this
// keeps the table free of redundant self-membership rows.
//
// Role hierarchy: owner > admin > editor > viewer
//   - owner   : full control, including billing + manage (delete/transfer)
//   - admin   : full content control + member management (no billing)
//   - editor  : read + write content (no member management, no API keys)
//   - viewer  : read-only
//
// Resources: project, connector, memory, research_job, api_key, billing
//
// The `can(role, resource, action)` predicate is the single source of
// truth for permission checks — routes should call `checkPermission`
// (which resolves the user's role for the target workspace) rather than
// re-implementing the hierarchy lookup themselves.
//
// SECURITY: when auth is not configured (single-tenant dev mode),
// `getUserId` returns "default" — the project owner is whoever created
// the project (the `projects.user_id` column). Multi-tenant RBAC only
// kicks in when `AUTH_USERNAME` / `AUTH_PASSWORD` are set AND multiple
// users are creating projects; in that case `workspace_members` rows
// grant non-owners access at a chosen role.

import { getDb } from "./db";

export type Role = "owner" | "admin" | "editor" | "viewer";
export type Resource =
  | "project"
  | "connector"
  | "memory"
  | "research_job"
  | "api_key"
  | "billing";
export type Action = "read" | "write" | "delete" | "manage" | "billing";

/**
 * Permission matrix: PERMISSIONS[role][resource] = allowed actions.
 *
 * `manage` is a superset of `read`/`write`/`delete` for the same resource
 * (it implies full lifecycle control). `billing` is a separate action
 * reserved for the `billing` resource so that admins can read the current
 * billing state (e.g. plan, current period usage) without being able to
 * manage the subscription.
 */
const PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
  owner: {
    project: ["read", "write", "delete", "manage"],
    connector: ["read", "write", "delete", "manage"],
    memory: ["read", "write", "delete", "manage"],
    research_job: ["read", "write", "delete", "manage"],
    api_key: ["read", "write", "delete", "manage"],
    billing: ["read", "manage", "billing"],
  },
  admin: {
    project: ["read", "write", "delete", "manage"],
    connector: ["read", "write", "delete", "manage"],
    memory: ["read", "write", "delete", "manage"],
    research_job: ["read", "write", "delete", "manage"],
    api_key: ["read", "write", "delete", "manage"],
    billing: ["read"],
  },
  editor: {
    project: ["read", "write"],
    connector: ["read", "write"],
    memory: ["read", "write"],
    research_job: ["read", "write"],
    api_key: ["read"],
    billing: [],
  },
  viewer: {
    project: ["read"],
    connector: ["read"],
    memory: ["read"],
    research_job: ["read"],
    api_key: [],
    billing: [],
  },
};

/**
 * Returns true if `role` is allowed to perform `action` on `resource`.
 * Defensive: unknown roles / resources return false (fail-closed).
 */
export function can(role: Role, resource: Resource, action: Action): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
}

/**
 * Returns the list of roles that satisfy a minimum role requirement.
 *
 *   requireRole("admin")  => ["admin", "owner"]
 *   requireRole("viewer") => ["viewer", "editor", "admin", "owner"]
 *
 * Useful for routes that want to short-circuit a 403 when the caller's
 * role is not in the required set (e.g. "only admins can invite members").
 */
export function requireRole(requiredRole: Role): Role[] {
  const hierarchy: Role[] = ["viewer", "editor", "admin", "owner"];
  const idx = hierarchy.indexOf(requiredRole);
  if (idx < 0) return [];
  return hierarchy.slice(idx);
}

/**
 * Resolve the user's role for a workspace/project.
 *
 * Checks project ownership FIRST (the `projects.user_id` column is the
 * source of truth for ownership — the project creator is implicitly an
 * `owner`). Falls back to the `workspace_members` table for non-owners
 * who were invited at a specific role. Returns null when the user has
 * no access (not the owner and not a member).
 *
 * Fail-soft: any DB error returns null (treated as "no access") so a
 * misbehaving DB never accidentally grants elevated privileges.
 */
export function getUserRole(userId: string, projectId: string): Role | null {
  try {
    const db = getDb();
    // Ensure the projects table exists (defensive — it's also created
    // eagerly by initSqliteSchema, but a fresh in-memory DB that
    // skipped that path would otherwise throw here).
    db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    // Check project ownership first.
    const project = db
      .prepare("SELECT user_id FROM projects WHERE id = ?")
      .get(projectId) as { user_id?: string } | undefined;
    if (project?.user_id === userId) return "owner";
    // The project exists but the caller is not the owner — fall through
    // to the membership table. If the project doesn't exist at all,
    // `project` is undefined and the membership lookup will also miss,
    // correctly returning null.
    ensureWorkspaceMembersTable();
    const membership = db
      .prepare(
        "SELECT role FROM workspace_members WHERE user_id = ? AND project_id = ?"
      )
      .get(userId, projectId) as { role?: Role } | undefined;
    return membership?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Middleware helper: resolve the caller's role for a workspace and check
 * whether they may perform `action` on `resource`.
 *
 * Returns `{ allowed: false, role: null }` when the user has no access
 * at all (not the owner, not a member). Returns `{ allowed: false, role }`
 * when the user IS a member but lacks the required permission — the
 * caller can distinguish "404 / not a member" from "403 / insufficient
 * role" by inspecting `role`.
 */
export function checkPermission(
  userId: string,
  projectId: string,
  resource: Resource,
  action: Action
): { allowed: boolean; role: Role | null } {
  const role = getUserRole(userId, projectId);
  if (!role) return { allowed: false, role: null };
  return { allowed: can(role, resource, action), role };
}

/**
 * Lazily create the `workspace_members` table. Idempotent — safe to call
 * on every request. The table is created with `CREATE TABLE IF NOT EXISTS`
 * plus two indexes (user_id, project_id) for the two common lookup paths
 * ("list my workspaces" and "list workspace members").
 *
 * Fail-soft: any DB error is swallowed (logged at warn level by the DB
 * layer). A misbehaving DB should never block request handling — the
 * downstream `getUserRole` call will also fail-soft to null and the
 * route will return a 404/403.
 */
export function ensureWorkspaceMembersTable(): void {
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, project_id)
    )`);
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id)"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_wm_project ON workspace_members(project_id)"
    );
  } catch {
    // Intentionally empty — see fail-soft note above.
  }
}
