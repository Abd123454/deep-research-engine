// GET /api/audit-logs — retrieve audit logs for the current user.
import { NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/audit";

export async function GET() {
  const userId = "default";
  const logs = getAuditLogs(userId, 100);
  return NextResponse.json({ logs, total: logs.length });
}
