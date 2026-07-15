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
    return {
      tool: "run_code",
      success: result.success,
      output: result.success ? result.output : `Error: ${result.error}`,
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

// ---------- Tool Registry ----------

export const AGENT_TOOLS: Record<string, AgentTool> = {
  run_code: runCodeTool,
  web_search: webSearchTool,
  read_file: readFileTool,
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
    } catch { /* not valid JSON */ }
  }

  // Pattern 2: [TOOL: name] params: {...}
  const inlineMatch = response.match(/\[TOOL:\s*(\w+)\]\s*params:\s*({[^}]*})/i);
  if (inlineMatch && inlineMatch[1] && AGENT_TOOLS[inlineMatch[1]]) {
    try {
      const params = JSON.parse(inlineMatch[2]);
      return { tool: inlineMatch[1], params };
    } catch { /* ignore */ }
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
