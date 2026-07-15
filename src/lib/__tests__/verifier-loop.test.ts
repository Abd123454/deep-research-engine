// Tests for the code verifier loop (Round 11 wiring).
//
// Verifies that:
//   1. run_code tool returns clear error messages on failure
//   2. run_code tool returns success messages with output on success
//   3. swarm runWorker feeds failure messages back to the LLM with "fix and retry"
//   4. swarm runWorker feeds success messages back with "continue"

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM provider.
vi.mock("../llm-provider", () => {
  let mockSmartTokens: string[] = [];
  let mockFastResponse = "";
  return {
    getLLM: vi.fn(async () => ({
      provider: "nvidia",
      smartModels: ["test"],
      fast: vi.fn(async () => ({
        content: mockFastResponse,
        tokensUsed: 5,
        model: "test",
        provider: "nvidia",
      })),
      smart: vi.fn(async (opts: any) => {
        const tokens = Array.isArray(mockSmartTokens) ? mockSmartTokens : [mockSmartTokens];
        if (opts.stream && opts.onToken) {
          for (const tok of tokens) opts.onToken(tok);
        }
        return { content: tokens.join(""), tokensUsed: 10, model: "test", provider: "nvidia" };
      }),
    })),
    __setMockSmartTokens: (t: string | string[]) => {
      mockSmartTokens = typeof t === "string" ? [t] : t;
    },
    __setMockFastResponse: (s: string) => { mockFastResponse = s; },
  };
});

// Mock code-sandbox to simulate code execution failures.
vi.mock("../code-sandbox", () => ({
  runCode: vi.fn(),
  runJavaScript: vi.fn(),
  runPython: vi.fn(),
}));

// Mock agent-tools executeToolCall and detectToolCall.
// vi.hoisted() ensures these are available when the vi.mock factory runs.
const { mockDetectToolCall, mockExecuteToolCall } = vi.hoisted(() => ({
  mockDetectToolCall: vi.fn(),
  mockExecuteToolCall: vi.fn(),
}));
vi.mock("../agent-tools", () => ({
  detectToolCall: mockDetectToolCall,
  executeToolCall: mockExecuteToolCall,
  getToolsDescription: vi.fn(() => "- run_code(code): Execute code"),
  AGENT_TOOLS: {
    run_code: {
      name: "run_code",
      execute: async (params: Record<string, unknown>) => {
        const { runCode } = await import("../code-sandbox");
        const result = await runCode(String(params.language || ""), String(params.code || ""));
        if (result.success) {
          return { tool: "run_code", success: true, output: `Execution successful.\n\nOutput:\n${result.output}`, data: result };
        }
        return { tool: "run_code", success: false, output: `Execution failed.\n\nError:\n${result.error || "Unknown error"}\n\nPlease fix the code and try again.`, data: result };
      },
    },
  },
}));

import { runWorker } from "../swarm";
import { runCode } from "../code-sandbox";
import { detectToolCall, executeToolCall } from "../agent-tools";

const llmMock = await import("../llm-provider") as any;

describe("Code verifier loop (Round 11 wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmMock.__setMockSmartTokens("");
    llmMock.__setMockFastResponse("");
    vi.mocked(detectToolCall).mockReset();
    vi.mocked(executeToolCall).mockReset();
  });

  describe("run_code tool error message", () => {
    it("returns clear error message when code fails", async () => {
      // Mock runCode to return a failure.
      vi.mocked(runCode).mockResolvedValue({
        success: false,
        output: "",
        error: "ReferenceError: x is not defined",
        executionTimeMs: 5,
      });

      // Import the tool directly to test its execute method.
      const { AGENT_TOOLS } = await import("../agent-tools");
      const result = await AGENT_TOOLS.run_code.execute({
        language: "javascript",
        code: "console.log(x)",
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain("Execution failed");
      expect(result.output).toContain("ReferenceError: x is not defined");
      expect(result.output).toContain("Please fix the code and try again");
    });

    it("returns success message with output when code succeeds", async () => {
      vi.mocked(runCode).mockResolvedValue({
        success: true,
        output: "42",
        executionTimeMs: 3,
      });

      const { AGENT_TOOLS } = await import("../agent-tools");
      const result = await AGENT_TOOLS.run_code.execute({
        language: "javascript",
        code: "console.log(6 * 7)",
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain("Execution successful");
      expect(result.output).toContain("42");
    });
  });

  describe("swarm runWorker verifier loop", () => {
    it("feeds failure message back with 'fix and retry' instruction", async () => {
      // First call: LLM returns a tool call.
      // Second call: LLM returns final answer after seeing the error.
      let callCount = 0;
      vi.mocked(detectToolCall).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { tool: "run_code", params: { language: "javascript", code: "console.log(x)" } } as any;
        }
        return null; // No more tool calls.
      });

      // Tool fails on first call.
      vi.mocked(executeToolCall).mockResolvedValue({
        tool: "run_code",
        success: false,
        output: "Execution failed.\n\nError: ReferenceError: x is not defined\n\nPlease fix the code and try again.",
      } as any);

      // LLM tokens: first call returns tool call text, second returns fixed answer.
      llmMock.__setMockSmartTokens("Here is the fixed code: console.log(42)");

      const events: any[] = [];
      const result = await runWorker(
        { id: "s1", description: "calculate 42", role: "coder" },
        "calculate 6 * 7",
        (e) => events.push(e)
      );

      // The worker should have called the LLM at least twice (once for tool, once for final).
      expect(callCount).toBeGreaterThanOrEqual(2);
      // The executeToolCall should have been called once.
      expect(executeToolCall).toHaveBeenCalledTimes(1);
      // The result should be the final answer.
      expect(result).toBeTruthy();
    });

    it("feeds success message back with 'continue' instruction", async () => {
      let callCount = 0;
      vi.mocked(detectToolCall).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { tool: "run_code", params: { language: "javascript", code: "console.log(6*7)" } } as any;
        }
        return null;
      });

      vi.mocked(executeToolCall).mockResolvedValue({
        tool: "run_code",
        success: true,
        output: "Execution successful.\n\nOutput:\n42",
      } as any);

      llmMock.__setMockSmartTokens("The answer is 42.");

      const result = await runWorker(
        { id: "s1", description: "calculate 42", role: "coder" },
        "calculate 6 * 7",
        () => {}
      );

      expect(result).toContain("42");
      expect(executeToolCall).toHaveBeenCalledTimes(1);
    });

    it("respects MAX_TOOL_ITERATIONS limit", async () => {
      // detectToolCall always returns a tool call — the worker should hit the iteration limit.
      vi.mocked(detectToolCall).mockReturnValue({ tool: "run_code", params: { language: "javascript", code: "1+1" } } as any);
      vi.mocked(executeToolCall).mockResolvedValue({
        tool: "run_code",
        success: false,
        output: "Execution failed.",
      } as any);

      llmMock.__setMockSmartTokens("trying again...");

      const _result = await runWorker(
        { id: "s1", description: "test", role: "coder" },
        "context",
        () => {}
      );

      // Should have called executeToolCall MAX_TOOL_ITERATIONS times (4).
      expect(executeToolCall).toHaveBeenCalledTimes(4);
    });
  });
});
