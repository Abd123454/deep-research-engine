// MCP (Model Context Protocol) Marketplace — STUB REGISTRY
//
// A catalog of MCP servers that Quaesitor *could* connect to. This is a
// forward-looking differentiator: the marketplace UI ships now (so the
// feature is visible and the design is locked in), while the actual MCP
// transport wiring is tracked as future work (see docs/ROADMAP_v2.md,
// Phase 2 — "MCP marketplace").
//
// What's real today:
//   - The registry itself (6 curated servers across 5 categories).
//   - GET /api/mcp/marketplace  → returns this list.
//   - POST /api/mcp/install     → marks a server as installed (in-memory
//                                 only; resets on server restart).
//
// What's NOT real yet:
//   - Actually connecting to an MCP server via the MCP transport.
//   - Persisting install state across restarts (no DB column yet).
//   - Routing research / chat queries through installed MCP servers.
//
// When real wiring lands:
//   - Replace `installedServers` Set with a Prisma-backed store.
//   - Add an `mcp://transport` resolver that opens a stdio/SSE connection
//     to the server endpoint.
//   - Extend `tools/list` in /api/mcp/route.ts to aggregate tools from
//     every installed server.

export type MCPCategory =
  | "academic"
  | "industry"
  | "government"
  | "tools"
  | "data";

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  category: MCPCategory;
  /** Lucide icon name (resolved on the client). */
  icon: string;
  endpoint: string;
  authRequired: boolean;
  capabilities: string[];
  installed: boolean;
}

/**
 * Canonical marketplace catalog. Order is intentional — academic sources
 * first (most useful for Quaesitor's research mission), then tools,
 * industry, government, data.
 *
 * Descriptions cite real-world corpus sizes (2.4M arXiv papers, 35M
 * PubMed citations, 11M USPTO patents, 8M CourtListener opinions) so
 * users understand the value before installing.
 */
export const MCP_MARKETPLACE: MCPServer[] = [
  {
    id: "arxiv",
    name: "arXiv",
    description: "Search 2.4M physics/math/CS papers",
    category: "academic",
    icon: "FileText",
    endpoint: "mcp://arxiv.org",
    authRequired: false,
    capabilities: ["search", "fetch"],
    installed: false,
  },
  {
    id: "pubmed",
    name: "PubMed",
    description: "35M biomedical citations",
    category: "academic",
    icon: "FileText",
    endpoint: "mcp://pubmed.ncbi.nlm.nih.gov",
    authRequired: false,
    capabilities: ["search", "fetch"],
    installed: false,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Search repositories, read code",
    category: "tools",
    icon: "Github",
    endpoint: "mcp://github.com",
    authRequired: true,
    capabilities: ["search", "read", "write"],
    installed: false,
  },
  {
    id: "scada",
    name: "SCADA Reference",
    description:
      "Industrial control systems standards (IEC 62443, NIST 800-82)",
    category: "industry",
    icon: "Cpu",
    endpoint: "mcp://scada-standards.org",
    authRequired: true,
    capabilities: ["search", "fetch"],
    installed: false,
  },
  {
    id: "patents",
    name: "USPTO Patents",
    description: "Search 11M granted patents",
    category: "government",
    icon: "FileText",
    endpoint: "mcp://uspto.gov",
    authRequired: false,
    capabilities: ["search", "fetch"],
    installed: false,
  },
  {
    id: "courtlistener",
    name: "CourtListener",
    description: "Search 8M federal and state court opinions",
    category: "government",
    icon: "Scale",
    endpoint: "mcp://courtlistener.com",
    authRequired: false,
    capabilities: ["search", "fetch"],
    installed: false,
  },
];

/**
 * In-memory install state. STUB: this resets on server restart.
*
* Mutated by /api/mcp/install (POST) — never read on the client.
 */
const installedServers = new Set<string>(MCP_MARKETPLACE.filter((s) => s.installed).map((s) => s.id));

/** Returns a shallow copy of the marketplace with current install state. */
export function getMarketplace(): MCPServer[] {
  return MCP_MARKETPLACE.map((s) => ({ ...s, installed: installedServers.has(s.id) }));
}

/** Returns only installed servers (current install state). */
export function getInstalledServers(): MCPServer[] {
  return getMarketplace().filter((s) => s.installed);
}

/** Returns the full catalog (alias for getMarketplace). */
export function getAvailableServers(): MCPServer[] {
  return getMarketplace();
}

/**
 * Mark a server as installed. STUB: in-memory only.
 *
 * @returns true if the server exists and the install state changed.
 */
export function installServer(id: string): boolean {
  if (!MCP_MARKETPLACE.some((s) => s.id === id)) return false;
  if (installedServers.has(id)) return false;
  installedServers.add(id);
  return true;
}

/**
 * Mark a server as uninstalled. STUB: in-memory only.
 *
 * @returns true if the server exists and was previously installed.
 */
export function uninstallServer(id: string): boolean {
  if (!installedServers.has(id)) return false;
  installedServers.delete(id);
  return true;
}

/** Look up a single server by id (with current install state). */
export function getServer(id: string): MCPServer | null {
  return getMarketplace().find((s) => s.id === id) || null;
}
