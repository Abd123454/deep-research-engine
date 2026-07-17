// GET /api/audit-logs — retrieve audit logs for the current user.
import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/audit";
import { getUserId, requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const logs = getAuditLogs(userId, 100);
  return NextResponse.json({ logs, total: logs.length });
}
