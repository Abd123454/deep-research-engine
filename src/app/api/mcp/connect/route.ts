// POST /api/mcp/connect — connect to an MCP server.
//
// Body: MCPServerConfig (see src/lib/mcp/transport.ts):
//   {
//     id: string,          // unique server id (e.g. "arxiv", "github")
//     name: string,        // display name
//     transport: "stdio" | "sse",
//     command?: string,    // stdio only — e.g. "npx"
//     args?: string[],     // stdio only — e.g. ["-y", "@mcp/server-fs"]
//     url?: string,        // sse only — e.g. "https://mcp.example.com/sse"
//     env?: Record<string, string>,
//     timeout?: number     // ms, default 5000
//   }
//
// Returns 200 with `{ ok, connected: true, serverId }` when the
// connection succeeds, 400 for invalid config, 504 on connect timeout,
// 500 on internal error. The connection is registered in the in-memory
// activeConnections map (per-process — see transport.ts for the
// persistence caveat).
//
// SECURITY: connecting to an external MCP server potentially exposes
// research/chat content to a third-party. Every connect is audit-logged
// with the server id, transport type, and (for sse) the URL. The real
// implementation should also validate the URL against an allowlist and
// scan the spawned process's env for secrets before forwarding it.
//
// Auth: requireAuth + getUserId (NOT API-key auth — these routes are
// part of the dashboard UI). IP allowlist (requireAdminAccess) is
// intentionally NOT applied — these routes are user-facing, not admin
// tooling.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId, requireAdminAccess } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { connectServer, type MCPServerConfig } from "@/lib/mcp/transport";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 60_000;

interface ConnectBody {
  id?: unknown;
  name?: unknown;
  transport?: unknown;
  command?: unknown;
  args?: unknown;
  url?: unknown;
  env?: unknown;
  timeout?: unknown;
}

/**
 * Validate and coerce the request body into an MCPServerConfig. Returns
 * `{ config }` on success, or `{ error }` with a 400-ready message on
 * validation failure.
 */
function validateConfig(
  body: ConnectBody
): { config: MCPServerConfig } | { error: string } {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return { error: "Server id is required." };
  if (id.length > 100) return { error: "Server id must be 100 characters or fewer." };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Server name is required." };

  const transport = body.transport === "stdio" || body.transport === "sse"
    ? body.transport
    : null;
  if (!transport) return { error: "Transport must be 'stdio' or 'sse'." };

  // Transport-specific validation.
  if (transport === "stdio") {
    const command = typeof body.command === "string" ? body.command.trim() : "";
    if (!command) return { error: "stdio transport requires a 'command' field." };
    const args = Array.isArray(body.args)
      ? body.args.filter((a): a is string => typeof a === "string")
      : [];
    if (body.args !== undefined && args.length !== (body.args as unknown[]).length) {
      return { error: "All 'args' entries must be strings." };
    }
  } else {
    // sse
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return { error: "sse transport requires a 'url' field." };
    try {
      // Validate URL syntax — also rejects non-http(s) schemes (file://,
      // data:, etc.) which would be a security hole in the real
      // implementation that fetches the URL.
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "URL must use http: or https: protocol." };
      }
    } catch {
      return { error: "URL is not a valid http(s) URL." };
    }
  }

  // Env validation: must be a flat string→string map (or absent).
  let env: Record<string, string> | undefined;
  if (body.env !== undefined) {
    if (typeof body.env !== "object" || body.env === null || Array.isArray(body.env)) {
      return { error: "'env' must be an object of string → string." };
    }
    const envObj = body.env as Record<string, unknown>;
    env = {};
    for (const [k, v] of Object.entries(envObj)) {
      if (typeof v !== "string") {
        return { error: `'env.${k}' must be a string.` };
      }
      env[k] = v;
    }
  }

  // Timeout validation: integer ms, clamped to [1, MAX_TIMEOUT_MS].
  let timeout = DEFAULT_TIMEOUT_MS;
  if (body.timeout !== undefined) {
    if (typeof body.timeout !== "number" || !Number.isFinite(body.timeout)) {
      return { error: "'timeout' must be a number (ms)." };
    }
    timeout = Math.max(1, Math.min(MAX_TIMEOUT_MS, Math.floor(body.timeout)));
  }

  const config: MCPServerConfig = {
    id,
    name,
    transport,
    timeout,
    ...(transport === "stdio"
      ? {
          command: typeof body.command === "string" ? body.command.trim() : undefined,
          args: Array.isArray(body.args)
            ? body.args.filter((a): a is string => typeof a === "string")
            : undefined,
        }
      : { url: typeof body.url === "string" ? body.url.trim() : undefined }),
    env,
  };

  return { config };
}

export async function POST(req: NextRequest) {
  // IP allowlist guard (no-op when ADMIN_IP_ALLOWLIST is unset). The
  // MCP routes are intentionally NOT in ADMIN_ROUTES — this guard is
  // belt-and-suspenders for operators who want to lock down MCP even
  // further.
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const validated = validateConfig(body);
  if ("error" in validated) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }
  const config = validated.config;

  try {
    // Audit-log BEFORE connecting so even a failed connect is recorded.
    // The metadata includes the server id, transport, and (for sse) the
    // URL. For stdio, the command + args are recorded so an operator
    // reviewing the audit log can see exactly what was spawned.
    logSensitiveAction("mcp.connect", userId, req, {
      serverId: config.id,
      serverName: config.name,
      transport: config.transport,
      ...(config.transport === "stdio"
        ? { command: config.command, args: config.args }
        : { url: config.url }),
    });

    // Race the connect against the timeout. The stub transport connects
    // instantly, but the real implementation may take seconds (stdio
    // subprocess startup, sse TLS handshake). We don't want a slow MCP
    // server to hold the request open indefinitely.
    const connectPromise = connectServer(config);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Connect timeout after ${config.timeout}ms`)),
        config.timeout
      );
    });

    await Promise.race([connectPromise, timeoutPromise]);

    logger.info(
      {
        module: "mcp",
        userId,
        serverId: config.id,
        transport: config.transport,
      },
      "MCP server connected"
    );

    return NextResponse.json({
      ok: true,
      connected: true,
      serverId: config.id,
      transport: config.transport,
      // Flag: the underlying transport is a stub. The dashboard can
      // surface this so users understand the connection is not yet
      // routing real messages.
      stub: true,
    });
  } catch (err) {
    logger.warn(
      {
        module: "mcp",
        userId,
        serverId: config.id,
        err: sanitizeError(err),
      },
      "MCP connect failed"
    );
    // Distinguish timeout (504) from other failures (500). The
    // sanitized error message is included so the dashboard can display
    // a useful reason.
    const msg = sanitizeError(err);
    const isTimeout = msg.includes("timeout") || msg.includes("Timeout");
    return NextResponse.json(
      { ok: false, error: msg || "Failed to connect to MCP server." },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
