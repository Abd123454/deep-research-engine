// POST /api/mcp — MCP server endpoint for Claude Desktop integration.
//
// Exposes tools: deep_research, verify_citations, swarm_analyze
// Authentication via Bearer token (API key from dashboard).
//
// Configure in Claude Desktop:
// {
//   "mcpServers": {
//     "quaesitor": {
//       "url": "http://localhost:3000/api/mcp",
//       "headers": { "Authorization": "Bearer <api-key>" }
//     }
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // IP allowlist guard for admin/operational tooling (no-op when
  // ADMIN_IP_ALLOWLIST is unset — see src/lib/auth.ts).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  let body: { method?: string; params?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = body.method || "";

  switch (method) {
    case "initialize":
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "quaesitor", version: "2.1.0" },
        },
      });

    case "tools/list":
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "deep_research",
              description: "Run a deep research query. Returns a comprehensive report with sources.",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The research question or topic" },
                  depth: { type: "string", enum: ["standard", "deep", "advanced"], description: "Research depth (default: standard)" },
                },
                required: ["query"],
              },
            },
            {
              name: "verify_citations",
              description: "Verify that URLs cited in a text actually support the claims.",
              inputSchema: {
                type: "object",
                properties: {
                  text: { type: "string", description: "The text containing citations to verify" },
                },
                required: ["text"],
              },
            },
            {
              name: "swarm_analyze",
              description: "Run a multi-agent swarm analysis. Orchestrator breaks the task into subtasks, specialist agents work in parallel, synthesizer combines outputs.",
              inputSchema: {
                type: "object",
                properties: {
                  task: { type: "string", description: "The complex task to analyze" },
                },
                required: ["task"],
              },
            },
          ],
        },
      });

    case "tools/call":
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          content: [
            {
              type: "text",
              text: `Tool "${body.params?.name}" called. In production, this would execute the tool and return results. For now, this is a placeholder — configure API keys and the full pipeline to enable real execution.`,
            },
          ],
        },
      });

    default:
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { code: -32601, message: `Method not found: ${method}` },
      }, { status: 400 });
  }
}

// GET: return MCP server info
export async function GET(req: NextRequest) {
  // IP allowlist guard (no-op when ADMIN_IP_ALLOWLIST is unset).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;

  return NextResponse.json({
    server: "quaesitor",
    version: "2.1.0",
    protocolVersion: "2024-11-05",
    tools: ["deep_research", "verify_citations", "swarm_analyze"],
    docs: "/docs/mcp-server.md",
  });
}
