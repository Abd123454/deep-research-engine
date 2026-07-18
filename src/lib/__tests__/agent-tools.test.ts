// Tests for agent-tools.ts — tool detection, execution, registry.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock searchWeb.
vi.mock("../retriever", () => ({
  searchWeb: vi.fn(async () => [
    { url: "https://example.com", name: "Example", snippet: "Test result", host_name: "example.com", rank: 1, date: "", favicon: "" },
  ]),
}));

// V2 audit fix: the vm fallback was removed from code-sandbox.ts.
// Docker is the only execution backend — but the agent-tools test
// suite runs in CI without Docker. Mock `runCode` so the `run_code`
// tool tests can focus on the wrapper logic (success path,
// error-message formatting) rather than on actually executing code.
// The mocked implementation echoes the code back so tests that check
// "the tool returned something containing <literal>" keep working.
//
// `vi.hoisted()` ensures the mock is available when the (hoisted)
// `vi.mock` factory runs — top-level `const` declarations are NOT
// visible inside `vi.mock` factories because the factory is hoisted
// above them.
//
// The return type is widened to `CodeResult` (with the optional
// `error` field) so the mock can return either success or failure
// shapes without TypeScript complaining.
const { mockRunCode } = vi.hoisted(() => ({
  mockRunCode: vi.fn(async (_language: string, code: string) => ({
    success: true,
    output: code,
    executionTimeMs: 1,
  })) as unknown as import("vitest").Mock<
    (language: string, code: string) => Promise<{
      success: boolean;
      output: string;
      error?: string;
      executionTimeMs: number;
    }>
  >,
}));
vi.mock("../code-sandbox", () => ({
  runCode: mockRunCode,
}));

// Mock fetch for read_file tool.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { detectToolCall, executeToolCall, getTool, getAvailableTools, getToolsDescription } from "../agent-tools";

beforeEach(() => {
  fetchMock.mockReset();
  mockRunCode.mockReset();
  // Default: runCode succeeds and echoes the code (so tests that look
  // for a literal in the output still pass).
  mockRunCode.mockImplementation(async (_lang: string, code: string) => ({
    success: true,
    output: code,
    executionTimeMs: 1,
  }));
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

  it("surfaces runCode failures with a clear error message (V2 — Docker required)", async () => {
    // Simulate the V2 audit-fix behavior: when Docker is not available,
    // runCode returns the Docker-required error. The agent-tools wrapper
    // should surface this in the tool result so the LLM can react.
    mockRunCode.mockResolvedValueOnce({
      success: false,
      output: "",
      error: "Docker is required for code execution. Set ENABLE_CODE_EXEC=true and install Docker.",
      executionTimeMs: 0,
    });
    const result = await executeToolCall({ tool: "run_code", params: { language: "javascript", code: "console.log('hi');" } });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Docker is required");
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
