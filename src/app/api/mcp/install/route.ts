// POST /api/mcp/install — install or uninstall an MCP server (STUB).
//
// Body: { id: string, action: "install" | "uninstall" }
//
// Marks the named server as installed in the in-memory registry.
// Real MCP transport wiring is future work (see docs/ROADMAP_v2.md,
// Phase 2 — "MCP marketplace"). Today this endpoint exists so the
// marketplace UI has a working install/uninstall button — the state
// is preserved for the lifetime of the server process only.
//
// Auth: required (requireAuth). Anonymous callers cannot change
// install state. The audit log records every install/uninstall so
// operators can see who enabled which server.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { installServer, uninstallServer, getServer } from "@/lib/mcp-marketplace";
import { logSensitiveAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InstallBody {
  id?: unknown;
  action?: unknown;
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

  let body: InstallBody;
  try {
    body = (await req.json()) as InstallBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "uninstall" ? "uninstall" : "install";

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing 'id' field." },
      { status: 400 }
    );
  }

  const existing = getServer(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: `Unknown MCP server: ${id}` },
      { status: 404 }
    );
  }

  let changed: boolean;
  if (action === "install") {
    changed = installServer(id);
  } else {
    changed = uninstallServer(id);
  }

  // Audit log — record who changed install state for which server.
  logSensitiveAction("admin.access", userId, req, {
    route: "mcp.install",
    serverId: id,
    serverName: existing.name,
    action,
    changed,
  });

  return NextResponse.json({
    ok: true,
    server: getServer(id),
    changed,
    stub: true,
  });
}
