// Tests for ReAct agent loop — tool execution + integration.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock searchWeb.
vi.mock("../retriever", () => ({
  searchWeb: vi.fn(async () => [
    { url: "https://example.com/result", name: "Test Result", snippet: "This is a test snippet", host_name: "example.com", rank: 1, date: "", favicon: "" },
  ]),
}));

// V2 audit fix: the vm fallback was removed from code-sandbox.ts.
// Docker is the only execution backend — but the react-agent test
// suite runs in CI without Docker. Mock `runCode` so the `run_code`
// tool tests focus on the wrapper logic, not on actual code execution.
// The mock echoes a deterministic output that the assertions look for.
//
// `vi.hoisted()` ensures the mock is available when the (hoisted)
// `vi.mock` factory runs — top-level `const` declarations are NOT
// visible inside `vi.mock` factories because the factory is hoisted
// above them.
const { mockRunCode } = vi.hoisted(() => ({
  mockRunCode: vi.fn(async (language: string, _code: string) => ({
    success: true,
    output: language === "python" ? "9" : "4",
    executionTimeMs: 1,
  })),
}));
vi.mock("../code-sandbox", () => ({
  runCode: mockRunCode,
}));

// Mock fetch for read_file tool.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { executeToolCall, detectToolCall, getAvailableTools, getToolsDescription, AGENT_TOOLS } from "../agent-tools";
import { getSkill } from "../skills";

beforeEach(() => {
  fetchMock.mockReset();
  vi.clearAllMocks();
  // Default: runCode succeeds and echoes a deterministic output.
  mockRunCode.mockImplementation(async (language: string, _code: string) => ({
    success: true,
    output: language === "python" ? "9" : "4",
    executionTimeMs: 1,
  }));
});

describe("ReAct — tool execution", () => {
  it("executes run_code (JavaScript)", async () => {
    const result = await executeToolCall({ tool: "run_code", params: { language: "javascript", code: "console.log(2+2);" } });
    expect(result.success).toBe(true);
    expect(result.output).toContain("4");
  });

  it("executes run_code (Python)", async () => {
    const result = await executeToolCall({ tool: "run_code", params: { language: "python", code: "print(3*3)" } });
    expect(result.success).toBe(true);
    expect(result.output).toContain("9");
  });

  it("executes web_search", async () => {
    const result = await executeToolCall({ tool: "web_search", params: { query: "AI news", num: 1 } });
    expect(result.success).toBe(true);
    expect(result.output).toContain("Test Result");
    expect(result.output).toContain("example.com");
  });

  it("handles unknown tool", async () => {
    const result = await executeToolCall({ tool: "nonexistent_tool", params: {} });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown tool");
  });

  it("handles missing required params", async () => {
    const result = await executeToolCall({ tool: "run_code", params: {} });
    expect(result.success).toBe(false);
  });
});

describe("ReAct — tool detection", () => {
  it("detects tool block format", () => {
    const response = 'Let me run code:\n```tool\n{"tool": "run_code", "params": {"language": "python", "code": "print(1)"}}\n```';
    const call = detectToolCall(response);
    expect(call).not.toBeNull();
    expect(call!.tool).toBe("run_code");
  });

  it("detects inline format", () => {
    const response = '[TOOL: web_search] params: {"query": "test"}';
    const call = detectToolCall(response);
    expect(call).not.toBeNull();
    expect(call!.tool).toBe("web_search");
  });

  it("returns null for no tool call", () => {
    expect(detectToolCall("Just a normal response.")).toBeNull();
  });
});

describe("ReAct — skills integration", () => {
  it("coder skill allows run_code", () => {
    const skill = getSkill("coder");
    expect(skill.allowedTools).toContain("run_code");
  });

  it("researcher skill allows web_search", () => {
    const skill = getSkill("researcher");
    expect(skill.allowedTools).toContain("web_search");
  });

  it("analyst skill allows both run_code and web_search", () => {
    const skill = getSkill("analyst");
    expect(skill.allowedTools).toContain("run_code");
    expect(skill.allowedTools).toContain("web_search");
  });

  it("writer skill has no tools", () => {
    const skill = getSkill("writer");
    expect(skill.allowedTools).toHaveLength(0);
  });

  it("default skill has no tools", () => {
    const skill = getSkill("default");
    expect(skill.allowedTools).toHaveLength(0);
  });

  it("skill system prompt includes tool descriptions when tools are allowed", () => {
    const skill = getSkill("coder");
    expect(skill.systemPrompt).toContain("run_code");
  });
});

describe("ReAct — tool registry", () => {
  it("has 4 tools registered", () => {
    expect(Object.keys(AGENT_TOOLS)).toHaveLength(4);
  });

  it("getAvailableTools returns all names", () => {
    const tools = getAvailableTools();
    expect(tools).toEqual(expect.arrayContaining(["run_code", "web_search", "read_file"]));
  });

  it("getToolsDescription includes all tools", () => {
    const desc = getToolsDescription();
    expect(desc).toContain("run_code");
    expect(desc).toContain("web_search");
    expect(desc).toContain("read_file");
  });
});
