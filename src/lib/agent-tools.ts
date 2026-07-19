// Agent Tools — tools that the AI agent can invoke during a conversation.
//
// Each tool has:
// - name: unique identifier
// - description: what it does (shown to the LLM)
// - parameters: JSON schema for the tool's input
// - execute: async function that runs the tool
//
// The ReAct loop in /api/chat reads the LLM's response, detects tool calls,
// executes them, and feeds results back to the LLM.
import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";


import { runCode, type CodeResult } from "./code-sandbox";
import { searchWeb } from "./retriever";
import type { SearchResultItem } from "./types";

export interface ToolParameter {
  name: string;
  type: "string" | "number";
  description: string;
  required: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  output: string;
  data?: unknown;
}

// ---------- Tool: run_code ----------

const runCodeTool: AgentTool = {
  name: "run_code",
  description: "Execute JavaScript or Python code in a sandboxed environment. Use this to calculate, test code, or process data. The code runs with a 10-second timeout and no network/filesystem access.",
  parameters: [
    { name: "language", type: "string", description: "Programming language: 'javascript' or 'python'", required: true },
    { name: "code", type: "string", description: "The code to execute", required: true },
  ],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const language = String(params.language || "");
    const code = String(params.code || "");
    if (!code) return { tool: "run_code", success: false, output: "No code provided." };

    const result: CodeResult = await runCode(language, code);
    if (result.success) {
      return {
        tool: "run_code",
        success: true,
        output: `Execution successful.\n\nOutput:\n${result.output}`,
        data: result,
      };
    }
    // On failure, return a clear error message that tells the LLM exactly
    // what went wrong, so it can fix the code and retry.
    return {
      tool: "run_code",
      success: false,
      output: `Execution failed.\n\nError:\n${result.error || "Unknown error"}\n\nPartial output:\n${result.output || "(none)"}\n\nPlease fix the code and try again. Common issues: syntax errors, undefined variables, type mismatches.`,
      data: result,
    };
  },
};

// ---------- Tool: web_search ----------

const webSearchTool: AgentTool = {
  name: "web_search",
  description: "Search the web for current information. Returns URLs, titles, and snippets. Use this when you need up-to-date information or facts you're not sure about.",
  parameters: [
    { name: "query", type: "string", description: "Search query", required: true },
    { name: "num_results", type: "number", description: "Number of results (default: 5, max: 10)", required: false },
  ],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = String(params.query || "");
    const num = Math.min(Number(params.num_results || 5), 10);
    if (!query) return { tool: "web_search", success: false, output: "No query provided." };

    try {
      const results: SearchResultItem[] = await searchWeb(query, num);
      const formatted = results
        .map((r, i) => `[${i + 1}] ${r.name}\n    ${r.url}\n    ${r.snippet}`)
        .join("\n\n");
      return {
        tool: "web_search",
        success: true,
        output: formatted || "No results found.",
        data: results,
      };
    } catch (err) {
      return {
        tool: "web_search",
        success: false,
        output: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------- Tool: read_file ----------

const readFileTool: AgentTool = {
  name: "read_file",
  description: "Read the text content of a previously uploaded document. Use this when the user references a file they uploaded.",
  parameters: [
    { name: "document_id", type: "string", description: "The document ID to read", required: true },
  ],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const docId = String(params.document_id || "");
    if (!docId) return { tool: "read_file", success: false, output: "No document ID provided." };

    // SECURITY (V5): validate docId is a safe identifier (UUID or alphanumeric),
    // not a path traversal attempt (e.g. "../../../etc/passwd")
    if (!/^[a-zA-Z0-9_-]+$/.test(docId)) {
      return { tool: "read_file", success: false, output: "Invalid document ID." };
    }

    try {
      const res = await fetch(`http://localhost:3000/api/documents/${docId}`);
      if (!res.ok) return { tool: "read_file", success: false, output: `Document not found (${res.status}).` };
      const data = await res.json();
      const text = data.document?.text || "";
      return {
        tool: "read_file",
        success: true,
        output: text.slice(0, 5000) || "(empty document)",
        data: { title: data.document?.title, textLength: data.document?.textLength },
      };
    } catch (err) {
      return {
        tool: "read_file",
        success: false,
        output: `Read failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------- Tool: device_control ----------

const deviceControlTool: AgentTool = {
  name: "device_control",
  description:
    "Control the user's device (Windows/macOS/Linux). Actions: system_info, list_files, read_file, write_file, execute_command, install_package, list_processes, kill_process, network_status, disk_usage, open_url, clipboard_read, clipboard_write. SECURITY: only use this tool when the user has explicitly asked you to perform a device action. Always explain what you are about to do before calling this tool. Never delete system files or run destructive commands (rm -rf /, format, etc.).",
  parameters: [
    { name: "action", type: "string", description: "The device action to perform", required: true },
    { name: "params", type: "string", description: "Action parameters as a JSON object (path, command, etc.) — pass a JSON-encoded string", required: false },
  ],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params.action || "");
    if (!action) {
      return { tool: "device_control", success: false, output: "No action provided." };
    }

    // The `params` field arrives either as an object (when the LLM emits
    // JSON with a nested object) or as a JSON-encoded string (when the
    // LLM treats it as a string parameter, which is what the schema
    // declares above). Accept both forms.
    let actionParams: Record<string, unknown> = {};
    const rawParams = params.params;
    if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
      actionParams = rawParams as Record<string, unknown>;
    } else if (typeof rawParams === "string" && rawParams.length > 0) {
      try {
        const parsed = JSON.parse(rawParams);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          actionParams = parsed as Record<string, unknown>;
        } else {
          return { tool: "device_control", success: false, output: "'params' must be a JSON object." };
        }
      } catch {
        return { tool: "device_control", success: false, output: "'params' is not valid JSON." };
      }
    }

    // Dynamic import keeps the device-control module (which pulls in
    // child_process / fs / os) out of the test bundle. The agent-tools
    // test suite mocks the LLM and code-sandbox; pulling in device-control
    // eagerly would also pull in better-sqlite3 transitively via db.ts
    // if we ever wire audit logging through here. Lazy import avoids that.
    const { executeDeviceAction, isDeviceAction } = await import("./device-control");
    if (!isDeviceAction(action)) {
      return {
        tool: "device_control",
        success: false,
        output: `Unknown device action: ${action}. Valid actions: system_info, list_files, read_file, write_file, delete_file, create_directory, execute_command, install_package, list_processes, kill_process, network_status, disk_usage, env_vars, open_url, clipboard_read, clipboard_write.`,
      };
    }

    const result = executeDeviceAction(action, actionParams);
    return {
      tool: "device_control",
      success: result.success,
      output: result.output || result.error || "",
    };
  },
};

// ---------- Tool Registry ----------

export const AGENT_TOOLS: Record<string, AgentTool> = {
  run_code: runCodeTool,
  web_search: webSearchTool,
  read_file: readFileTool,
  device_control: deviceControlTool,
};

export function getTool(name: string): AgentTool | null {
  return AGENT_TOOLS[name] || null;
}

export function getAvailableTools(): string[] {
  return Object.keys(AGENT_TOOLS);
}

export function getToolsDescription(): string {
  return Object.values(AGENT_TOOLS)
    .map((t) => `- ${t.name}(${t.parameters.map((p) => `${p.name}${p.required ? "" : "?"}`).join(", ")}): ${t.description}`)
    .join("\n");
}

// ---------- Tool Call Detection (from LLM response) ----------

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export function detectToolCall(response: string): ToolCall | null {
  // Pattern 1: ```tool\n{"tool": "name", "params": {...}}\n```
  const toolBlockMatch = response.match(/```tool\s*\n([\s\S]*?)```/i);
  if (toolBlockMatch && toolBlockMatch[1]) {
    try {
      const parsed = JSON.parse(toolBlockMatch[1].trim());
      if (parsed.tool && AGENT_TOOLS[parsed.tool]) {
        return { tool: parsed.tool, params: parsed.params || {} };
      }
    } catch (err) {
      // Non-critical: LLM emitted a tool-call block whose body wasn't valid
      // JSON (common with smaller models that forget closing braces). Try
      // the inline [TOOL: ...] pattern below before giving up.
      Sentry.captureException(err);
      logger.debug(
        { module: "agent-tools", err: err instanceof Error ? err.message : String(err) },
        "detectToolCall: fenced-block JSON parse failed — trying inline pattern"
      );
    }
  }

  // Pattern 2: [TOOL: name] params: {...}
  const inlineMatch = response.match(/\[TOOL:\s*(\w+)\]\s*params:\s*({[^}]*})/i);
  if (inlineMatch && inlineMatch[1] && AGENT_TOOLS[inlineMatch[1]]) {
    try {
      const params = JSON.parse(inlineMatch[2]);
      return { tool: inlineMatch[1], params };
    } catch (err) {
      // Non-critical: inline params weren't valid JSON. Return null — the
      // ReAct loop will treat the response as plain text.
      Sentry.captureException(err);
      logger.debug(
        { module: "agent-tools", err: err instanceof Error ? err.message : String(err) },
        "detectToolCall: inline-params JSON parse failed — treating response as text"
      );
    }
  }

  return null;
}

// ---------- Execute Tool Call ----------

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const tool = getTool(call.tool);
  if (!tool) {
    return { tool: call.tool, success: false, output: `Unknown tool: ${call.tool}` };
  }
  return tool.execute(call.params);
}
