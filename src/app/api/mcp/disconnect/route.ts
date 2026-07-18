// POST /api/mcp/disconnect — disconnect from an MCP server.
//
// Body: { id: string }  OR  ?id=<serverId> query parameter
//
// Idempotent — returns 200 with `{ ok, disconnected: true }` whether or
// not a connection existed for the given id. This matches the dashboard
// UX: the "disconnect" button should always succeed (no "not connected"
// error to confuse the user).
//
// SECURITY: every disconnect is audit-logged. The audit trail shows
// which user tore down which MCP connection (and when) so an operator
// can reconstruct the lifecycle of an external integration.
//
// Auth: requireAuth + getUserId (NOT API-key auth). IP allowlist
// (requireAdminAccess) is applied as belt-and-suspenders — these routes
// are user-facing, not admin tooling, but operators who set
// ADMIN_IP_ALLOWLIST for /api/mcp will get the same restriction here.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId, requireAdminAccess } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { disconnectServer, getTransport } from "@/lib/mcp/transport";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DisconnectBody {
  id?: unknown;
}

export async function POST(req: NextRequest) {
  // IP allowlist guard (no-op when ADMIN_IP_ALLOWLIST is unset).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  // Accept the server id from either the JSON body or the ?id= query
  // parameter — the dashboard sends a body, but a fetch-without-body
  // call (e.g. from a `confirm()`-then-redirect flow) can use the query
  // parameter. Either is fine.
  let body: DisconnectBody = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      body = (await req.json()) as DisconnectBody;
    } catch {
      // Body is malformed JSON — fall back to the query parameter below.
      body = {};
    }
  }
  const fromBody = typeof body.id === "string" ? body.id.trim() : "";
  const fromQuery = req.nextUrl.searchParams.get("id")?.trim() || "";
  const serverId = fromBody || fromQuery;

  if (!serverId) {
    return NextResponse.json(
      { ok: false, error: "Server id is required (in body or ?id= query)." },
      { status: 400 }
    );
  }
  if (serverId.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Server id must be 100 characters or fewer." },
      { status: 400 }
    );
  }

  // Audit-log BEFORE disconnecting so even a failed disconnect (e.g.
  // the transport throws on cleanup) is recorded. The metadata includes
  // whether a connection actually existed (`wasConnected`) so the audit
  // trail can distinguish real disconnects from no-op idempotent calls.
  const wasConnected = !!getTransport(serverId)?.isConnected();
  logSensitiveAction("mcp.disconnect", userId, req, {
    serverId,
    wasConnected,
  });

  try {
    await disconnectServer(serverId);
    logger.info(
      { module: "mcp", userId, serverId, wasConnected },
      "MCP server disconnected"
    );
    return NextResponse.json({
      ok: true,
      disconnected: true,
      serverId,
      wasConnected,
    });
  } catch (err) {
    // The stub disconnect can't fail, but the real implementation might
    // (e.g. a child process that ignores SIGTERM). Fail-soft: return
    // 200 anyway and remove the entry from the registry (the transport
    // layer does this regardless of disconnect success).
    logger.warn(
      {
        module: "mcp",
        userId,
        serverId,
        err: sanitizeError(err),
      },
      "MCP disconnect failed (fail-soft)"
    );
    return NextResponse.json({
      ok: true,
      disconnected: true,
      serverId,
      wasConnected,
      warning: sanitizeError(err) || "Disconnect reported an error but completed.",
    });
  }
}
