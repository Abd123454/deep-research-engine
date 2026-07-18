// GET /api/memories/graph — return the user's memory graph (nodes + edges)
// for visualization.
//
// Query params:
//   - limit (optional, default 50, max 200) — how many recent memories to
//     include as nodes. Edges to memories outside the limit are dropped
//     so the visualization stays readable.
//
// Returns: { ok: true, graph: { nodes: MemoryNode[], edges: MemoryEdge[] } }
//
// P1-wave2 / Feature 2: Memory Graph. The graph is built automatically
// when memories are stored (see memory-extractor.ts → storeMemoryEdges).
// This route is read-only — the frontend renders the result as a
// force-directed graph.

import { NextRequest, NextResponse } from "next/server";
import { getMemoryGraph, type GraphData } from "@/lib/memory-graph";
import { getUserId, requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

  // Parse + clamp the limit. Generous max (200) so a power user with
  // many memories can still see the full picture; the frontend can
  // paginate / cluster beyond that.
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

  const graph: GraphData = getMemoryGraph(userId, limit);

  return NextResponse.json({
    ok: true,
    graph: {
      nodes: graph.nodes,
      edges: graph.edges,
    },
  });
}
