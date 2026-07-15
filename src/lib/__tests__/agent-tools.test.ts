// Tests for agent-tools.ts — tool detection, execution, registry.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock searchWeb.
vi.mock("../retriever", () => ({
  searchWeb: vi.fn(async () => [
    { url: "https://example.com", name: "Example", snippet: "Test result", host_name: "example.com", rank: 1, date: "", favicon: "" },
  ]),
}));

// Mock fetch for read_file tool.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { detectToolCall, executeToolCall, getTool, getAvailableTools, getToolsDescription } from "../agent-tools";

beforeEach(() => {
  fetchMock.mockReset();
});

describe("detectToolCall", () => {
  it("detects tool block format", () => {
    const response = 'Some text\n```tool\n{"tool": "run_code", "params": {"language": "python", "code": "print(1)"}}\n```';
    const call = detectToolCall(response);
    expect(call).not.toBeNull();
    expect(call!.tool).toBe("run_code");
    expect(call!.params.language).toBe("python");
  });

  it("detects inline format", () => {
    const response = '[TOOL: web_search] params: {"query": "AI news"}';
    const call = detectToolCall(response);
    expect(call).not.toBeNull();
    expect(call!.tool).toBe("web_search");
    expect(call!.params.query).toBe("AI news");
  });

  it("returns null for no tool call", () => {
    expect(detectToolCall("Just a normal response.")).toBeNull();
  });

  it("returns null for unknown tool", () => {
    const response = '```tool\n{"tool": "unknown_tool", "params": {}}\n```';
    expect(detectToolCall(response)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectToolCall("")).toBeNull();
  });
});

describe("executeToolCall", () => {
  it("executes run_code tool", async () => {
    const result = await executeToolCall({ tool: "run_code", params: { language: "javascript", code: "console.log('test');" } });
    expect(result.tool).toBe("run_code");
    expect(result.success).toBe(true);
    expect(result.output).toContain("test");
  });

  it("executes web_search tool", async () => {
    const result = await executeToolCall({ tool: "web_search", params: { query: "test query" } });
    expect(result.tool).toBe("web_search");
    expect(result.success).toBe(true);
    expect(result.output).toContain("Example");
  });

  it("returns error for unknown tool", async () => {
    const result = await executeToolCall({ tool: "nonexistent", params: {} });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown tool");
  });

  it("handles run_code with no code", async () => {
    const result = await executeToolCall({ tool: "run_code", params: { language: "python" } });
    expect(result.success).toBe(false);
    expect(result.output).toContain("No code");
  });
});

describe("tool registry", () => {
  it("getTool returns tool by name", () => {
    const tool = getTool("run_code");
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("run_code");
  });

  it("getTool returns null for unknown", () => {
    expect(getTool("nonexistent")).toBeNull();
  });

  it("getAvailableTools returns all tool names", () => {
    const tools = getAvailableTools();
    expect(tools).toContain("run_code");
    expect(tools).toContain("web_search");
    expect(tools).toContain("read_file");
    expect(tools.length).toBe(3);
  });

  it("getToolsDescription returns formatted string", () => {
    const desc = getToolsDescription();
    expect(desc).toContain("run_code");
    expect(desc).toContain("web_search");
    expect(desc).toContain("read_file");
  });
});
