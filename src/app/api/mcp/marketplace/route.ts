// GET /api/mcp/marketplace — list available MCP servers.
//
// Returns the marketplace catalog with current install state. The
// client uses this to render the marketplace UI; install/uninstall
// state is reflected immediately because `getMarketplace()` reads
// the in-memory Set every call.
//
// This endpoint is NOT admin-gated (unlike /api/mcp itself) because
// the catalog is public information — operators WANT users to see
// what's available. The actual install/uninstall action IS auth-gated
// (see /api/mcp/install/route.ts) so anonymous callers can't change
// server state.

import { NextResponse } from "next/server";
import { getMarketplace } from "@/lib/mcp-marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const servers = getMarketplace();
  return NextResponse.json({
    ok: true,
    servers,
    // Surface the stub status so the UI can warn users that real
    // MCP transport wiring is future work (see docs/ROADMAP_v2.md).
    stub: true,
    installedCount: servers.filter((s) => s.installed).length,
  });
}
