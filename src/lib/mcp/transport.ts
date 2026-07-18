// MCP Transport — Model Context Protocol transport layer.
//
// Supports two transport types:
//   - stdio: for local MCP servers (a child process speaking JSON-RPC
//            over stdin/stdout, e.g. `npx -y @modelcontextprotocol/server-filesystem`)
//   - sse  : for remote MCP servers (an HTTP endpoint that streams
//            JSON-RPC messages via Server-Sent Events)
//
// This is the interface + connection registry — the actual child_process
// spawning and EventSource wiring is intentionally STUBBED. The
// @modelcontextprotocol/sdk package is installed (see package.json) but
// the real wiring is tracked as enterprise-tier work. Today this module
// gives the API routes a stable shape so the dashboard can show "connected"
// / "disconnected" status without crashing, and the real implementation
// can land here without touching the call sites.
//
// SECURITY: when real wiring lands:
//   - stdio: spawn the child with `--no-new-privileges` + a tight env
//     (only the credentials the server needs, never the full process env).
//   - sse  : validate the URL against an allowlist, never follow redirects
//     to internal addresses (SSRF), and rate-limit the message bus.
//   - Both: cap message size (256 KB default), reject messages that
//     don't parse as JSON-RPC 2.0, and audit-log every connect/disconnect.
//
// The active-connections registry is a module-level Map keyed by server id.
// It is intentionally NOT persisted — the registry is per-process state.
// When the server restarts, all MCP connections need to be re-established
// (the dashboard can call /api/mcp/connect for each previously-installed
// server on page load).

/**
 * Common interface for both transport types. The registry stores
 * instances of this interface so the API routes don't need to care
 * whether a given server is stdio or sse — they just call connect /
 * disconnect / send on the returned transport.
 */
export interface MCPTransport {
  readonly type: "stdio" | "sse";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: unknown): Promise<void>;
  onMessage(handler: (message: unknown) => void): void;
  isConnected(): boolean;
}

/**
 * Static configuration for an MCP server. Stored in the registry (keyed
 * by `id`) so a transport can be re-established after disconnect.
 *
 * For stdio:
 *   - `command` (e.g. "npx") + `args` (e.g. ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])
 *   - `env` is merged onto the spawn env (defaults to {} = inherit all)
 *
 * For sse:
 *   - `url` is the SSE endpoint (e.g. "https://mcp.example.com/sse")
 *   - `env` is ignored (no spawn)
 *
 * `timeout` (ms) is the connect timeout — the real implementation
 * aborts the connection attempt after this many milliseconds.
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  command?: string; // for stdio
  args?: string[]; // for stdio
  url?: string; // for sse
  env?: Record<string, string>;
  timeout: number; // ms
}

/**
 * Stub stdio transport.
 *
 * The real implementation would `child_process.spawn(config.command,
 * config.args, { env: { ...process.env, ...config.env }, stdio:
 * ["pipe", "pipe", "inherit"] })`, then read JSON-RPC messages line-by-
 * line from stdout and write JSON-RPC messages + "\n" to stdin. The
 * stub just flips a `connected` boolean so the registry / API routes
 * exercise the lifecycle shape without spawning real subprocesses.
 */
export class StdioTransport implements MCPTransport {
  public readonly type: "stdio" = "stdio";
  /**
   * The underlying child process. Typed as `unknown` because the real
   * type (`ChildProcess` from node:child_process) isn't imported here
   * — the stub doesn't spawn anything. The structural shape mirrors
   * what the real implementation will use.
   */
  private process: {
    pid: number;
    kill: (signal?: string) => void;
    stdout: { on: (event: string, handler: (data: Buffer) => void) => void };
    stdin: { write: (data: string) => boolean; end: () => void };
  } | null = null;
  private messageHandlers: Array<(message: unknown) => void> = [];
  private connected = false;

  constructor(private config: MCPServerConfig) {}

  async connect(): Promise<void> {
    if (this.connected) return;
    // Real implementation:
    //   const { spawn } = await import("node:child_process");
    //   this.process = spawn(this.config.command!, this.config.args ?? [], {
    //     env: { ...process.env, ...this.config.env },
    //     stdio: ["pipe", "pipe", "inherit"],
    //   });
    //   this.process.stdout.on("data", (chunk: Buffer) => {
    //     for (const line of chunk.toString("utf8").split("\n")) {
    //       if (!line.trim()) continue;
    //       try {
    //         const msg = JSON.parse(line);
    //         this.messageHandlers.forEach((h) => h(msg));
    //       } catch { /* partial line — buffer */ }
    //     }
    //   });
    // Stub: just mark as connected.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      try {
        this.process.kill("SIGTERM");
        this.process.stdin.end();
      } catch {
        // Process may have already exited — ignore.
      }
      this.process = null;
    }
    this.connected = false;
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) {
      throw new Error("Transport not connected");
    }
    // Real implementation:
    //   this.process!.stdin.write(JSON.stringify(message) + "\n");
    // Stub: no-op (no real subprocess to write to).
    void message;
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Stub SSE transport.
 *
 * The real implementation would use the WHATWG `EventSource` (or the
 * `eventsource` npm package in Node) to open a long-lived connection
 * to `config.url`. Server-sent events are decoded as JSON-RPC messages
 * and dispatched to the registered handlers. Sending requires a
 * separate POST endpoint (SSE is read-only) — the real implementation
 * would discover the POST endpoint from the server's `initialize`
 * response and POST each outbound message there.
 */
export class SSETransport implements MCPTransport {
  public readonly type: "sse" = "sse";
  /**
   * The underlying EventSource. Typed as a minimal structural shape
   * because `EventSource` isn't imported here — the stub doesn't open
   * a real connection. The shape mirrors what the real implementation
   * will use.
   */
  private eventSource: {
    close: () => void;
    onmessage: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
  } | null = null;
  private messageHandlers: Array<(message: unknown) => void> = [];
  private connected = false;

  constructor(private config: MCPServerConfig) {}

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.config.url) {
      throw new Error("SSE transport requires a `url` in the config");
    }
    // Real implementation:
    //   const EventSource = (await import("eventsource")).default;
    //   this.eventSource = new EventSource(this.config.url);
    //   this.eventSource.onmessage = (e) => {
    //     try {
    //       this.messageHandlers.forEach((h) => h(JSON.parse(e.data)));
    //     } catch { /* ignore malformed */ }
    //   };
    //   this.eventSource.onerror = () => { this.connected = false; };
    // Stub: just mark as connected.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // Already closed — ignore.
      }
      this.eventSource = null;
    }
    this.connected = false;
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) {
      throw new Error("Transport not connected");
    }
    // Real implementation: POST the message to the server's designated
    // POST endpoint (discovered during `initialize`). SSE is read-only.
    // Stub: no-op.
    void message;
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Factory: create a transport instance from a config. Throws for unknown
 * transport types (defensive — the type union should make this
 * unreachable, but a runtime guard is cheaper than a Sentry alert).
 */
export function createTransport(config: MCPServerConfig): MCPTransport {
  if (config.transport === "stdio") return new StdioTransport(config);
  if (config.transport === "sse") return new SSETransport(config);
  throw new Error(`Unknown transport type: ${config.transport}`);
}

/**
 * Per-process registry of active MCP server connections. Keyed by server
 * id. Not persisted — re-established on server restart by the dashboard
 * calling /api/mcp/connect for each previously-installed server.
 *
 * The Map is module-level (single instance per Node process). In a
 * serverless deployment this means each warm lambda has its own registry;
 * in a long-running server (the default for this project) the registry
 * survives across requests.
 */
const activeConnections = new Map<string, MCPTransport>();

/**
 * Connect to an MCP server. Idempotent — if a connection for the same
 * id is already live, returns the existing transport without re-
 * connecting. If a stale entry exists (disconnected but not yet removed),
 * it's replaced with a fresh transport.
 */
export async function connectServer(
  config: MCPServerConfig
): Promise<MCPTransport> {
  const existing = activeConnections.get(config.id);
  if (existing?.isConnected()) return existing;

  const transport = createTransport(config);
  await transport.connect();
  activeConnections.set(config.id, transport);
  return transport;
}

/**
 * Disconnect from an MCP server by id. No-op if no connection exists
 * for that id (idempotent — safe to call on every dashboard "disconnect"
 * button click).
 */
export async function disconnectServer(serverId: string): Promise<void> {
  const transport = activeConnections.get(serverId);
  if (transport) {
    await transport.disconnect();
    activeConnections.delete(serverId);
  }
}

/**
 * Disconnect from ALL active MCP servers. Used by the server-shutdown
 * hook (if/when wired) to clean up child processes / event sources
 * before the process exits.
 */
export async function disconnectAll(): Promise<void> {
  // Snapshot the keys first — `disconnectServer` mutates the Map while
  // we're iterating over it.
  const ids = Array.from(activeConnections.keys());
  await Promise.all(ids.map((id) => disconnectServer(id)));
}

/**
 * Returns the ids of all currently-active (connected) MCP servers.
 * Used by the dashboard to render the "connected servers" list.
 */
export function getActiveConnections(): string[] {
  return Array.from(activeConnections.keys());
}

/**
 * Look up a specific transport by server id. Returns null when no
 * transport is registered for that id (whether never connected or
 * already disconnected).
 */
export function getTransport(serverId: string): MCPTransport | null {
  return activeConnections.get(serverId) ?? null;
}
