// GET /api/audit-logs — retrieve audit logs for the current user.
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuditLogs, logSensitiveAction } from "@/lib/audit";
import { getUserId, requireAuth, requireAdminAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export async function GET(req: NextRequest) {
  // IP allowlist guard for admin/operational tooling (no-op when
  // ADMIN_IP_ALLOWLIST is unset — see src/lib/auth.ts).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    // SECURITY: resolve userId from auth (was hardcoded "default").
    const userId = getUserId(req);
    // SENSITIVE ACTION: admin access — audit log reads are themselves
    // auditable. (Resource: admin.)
    logSensitiveAction("admin.access", userId, req, { route: "audit-logs" });
    const logs = getAuditLogs(userId, 100);
    return NextResponse.json({ ok: true, data: { logs, total: logs.length } });
  } catch (err) {
    // FB-3 fix: unhandled errors crashed the route (HTTP 500 with stack
    // trace leak). Wrap in try/catch and return a sanitized 500.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "audit-logs", err: safe }, "audit log fetch failed");
    return NextResponse.json(
      { ok: false, error: safe || "Failed to retrieve audit logs." },
      { status: 500 }
    );
  }
}
