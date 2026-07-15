// Tests for the Agent Swarm module.
//
// These tests mock the LLM provider so they run fast and don't need
// API keys. They verify:
//   1. planSwarm parses the orchestrator's JSON and produces subtasks
//   2. planSwarm falls back to a single generalist on malformed output
//   3. runWorker emits the correct event sequence
//   4. synthesizeSwarm streams tokens
//   5. runSwarm orchestrates plan → workers → synthesis end-to-end

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock the LLM provider ----------

vi.mock("../llm-provider", () => {
  let mockFastResponse = "";
  let mockSmartTokens: string[] = [];
  let mockSmartThrowCount = 0; // how many smart() calls should throw (from the start)
  let globalSmartCallIndex = 0; // tracks ALL smart() calls across getLLM() instances

  return {
    getLLM: vi.fn(async () => ({
      provider: "nvidia",
      smartModels: ["test-model"],
      fast: vi.fn(async () => ({
        content: mockFastResponse,
        tokensUsed: 10,
        model: "test-model",
        provider: "nvidia",
      })),
      smart: vi.fn(async (opts: any) => {
        const callNum = ++globalSmartCallIndex;
        if (callNum <= mockSmartThrowCount) throw new Error("LLM failed");
        if (opts.stream && opts.onToken) {
          for (const tok of mockSmartTokens) opts.onToken(tok);
        }
        return {
          content: mockSmartTokens.join(""),
          tokensUsed: 50,
          model: "test-model",
          provider: "nvidia",
        };
      }),
    })),
    // Test-only setters.
    __setMockFastResponse: (s: string) => { mockFastResponse = s; },
    __setMockSmartTokens: (t: string[]) => { mockSmartTokens = t; },
    __setMockSmartThrowCount: (n: number) => { mockSmartThrowCount = n; },
    __resetSmartCallIndex: () => { globalSmartCallIndex = 0; },
  };
});

// Mock agent-tools to avoid real web/code execution.
vi.mock("../agent-tools", () => ({
  detectToolCall: vi.fn(() => null), // no tool calls by default
  executeToolCall: vi.fn(async () => ({ tool: "test", success: true, output: "ok" })),
  getToolsDescription: vi.fn(() => "- web_search(query): Search\n- run_code(code): Execute"),
}));

import { planSwarm, runSwarm, runWorker, synthesizeSwarm, type SwarmEvent } from "../swarm";

// Get the mock setters (cast to access the test-only exports).
const llmMock = await import("../llm-provider") as any;

describe("Agent Swarm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmMock.__setMockFastResponse("");
    llmMock.__setMockSmartTokens([]);
    llmMock.__setMockSmartThrowCount(0);
    llmMock.__resetSmartCallIndex();
  });

  describe("planSwarm", () => {
    it("parses valid JSON output into subtasks", async () => {
      llmMock.__setMockFastResponse(JSON.stringify({
        subtasks: [
          { description: "Research the topic", role: "researcher" },
          { description: "Write a summary", role: "writer" },
        ],
      }));

      const subtasks = await planSwarm("Tell me about AI");
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].description).toBe("Research the topic");
      expect(subtasks[0].role).toBe("researcher");
      expect(subtasks[1].role).toBe("writer");
      expect(subtasks[0].id).toMatch(/^s\d+$/);
    });

    it("limits to 4 subtasks", async () => {
      llmMock.__setMockFastResponse(JSON.stringify({
        subtasks: [
          { description: "t1", role: "researcher" },
          { description: "t2", role: "coder" },
          { description: "t3", role: "analyst" },
          { description: "t4", role: "writer" },
          { description: "t5", role: "generalist" },
        ],
      }));

      const subtasks = await planSwarm("complex task");
      expect(subtasks).toHaveLength(4);
    });

    it("falls back to single generalist on malformed JSON", async () => {
      llmMock.__setMockFastResponse("This is not JSON at all");

      const subtasks = await planSwarm("broken task");
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].role).toBe("generalist");
      expect(subtasks[0].description).toBe("broken task");
    });

    it("falls back when subtasks array is empty", async () => {
      llmMock.__setMockFastResponse(JSON.stringify({ subtasks: [] }));

      const subtasks = await planSwarm("empty");
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].role).toBe("generalist");
    });

    it("defaults invalid role to generalist", async () => {
      llmMock.__setMockFastResponse(JSON.stringify({
        subtasks: [
          { description: "task", role: "invalid_role" },
        ],
      }));

      const subtasks = await planSwarm("test");
      expect(subtasks[0].role).toBe("generalist");
    });
  });

  describe("runWorker", () => {
    it("emits agent_token events and returns output", async () => {
      llmMock.__setMockSmartTokens(["Hello", " from", " worker"]);
      const events: SwarmEvent[] = [];
      const emit = (e: SwarmEvent) => events.push(e);

      const result = await runWorker(
        { id: "s1", description: "Say hello", role: "writer" },
        "context task",
        emit
      );

      expect(result).toContain("Hello from worker");
      expect(events.filter((e) => e.type === "agent_token")).toHaveLength(3);
    });

    it("produces no tool events when no tool is called", async () => {
      llmMock.__setMockSmartTokens(["Just text"]);
      const events: SwarmEvent[] = [];

      await runWorker(
        { id: "s1", description: "test", role: "generalist" },
        "ctx",
        (e) => events.push(e)
      );

      expect(events.filter((e) => e.type === "agent_tool")).toHaveLength(0);
    });
  });

  describe("synthesizeSwarm", () => {
    it("emits synth_start and synth_token events", async () => {
      llmMock.__setMockSmartTokens(["Final", " report"]);
      const events: SwarmEvent[] = [];

      const result = await synthesizeSwarm(
        "task",
        [{ role: "researcher", subtask: "research", output: "findings" }],
        (e) => events.push(e)
      );

      expect(result).toContain("Final report");
      expect(events.some((e) => e.type === "synth_start")).toBe(true);
      expect(events.filter((e) => e.type === "synth_token")).toHaveLength(2);
    });
  });

  describe("runSwarm (end-to-end)", () => {
    it("orchestrates plan → workers → synthesis", async () => {
      // Plan returns 2 subtasks; smart (workers + synth) returns tokens.
      llmMock.__setMockFastResponse(JSON.stringify({
        subtasks: [
          { description: "Research X", role: "researcher" },
          { description: "Write about X", role: "writer" },
        ],
      }));
      llmMock.__setMockSmartTokens(["output "]);

      const events: SwarmEvent[] = [];
      const { plan, finalReport } = await runSwarm("test task", (e) => events.push(e));

      expect(plan.subtasks).toHaveLength(2);
      expect(finalReport).toBeTruthy();
      expect(events.some((e) => e.type === "swarm_start")).toBe(true);
      expect(events.filter((e) => e.type === "agent_start")).toHaveLength(2);
      expect(events.filter((e) => e.type === "agent_done")).toHaveLength(2);
      expect(events.some((e) => e.type === "synth_start")).toBe(true);
      expect(events.some((e) => e.type === "swarm_done")).toBe(true);
    });

    it("continues if a worker fails", async () => {
      // Plan succeeds (1 subtask); worker (call 1) throws, synthesizer (call 2) succeeds.
      llmMock.__setMockFastResponse(JSON.stringify({
        subtasks: [{ description: "t", role: "researcher" }],
      }));
      llmMock.__setMockSmartTokens(["synth output"]);
      llmMock.__setMockSmartThrowCount(1);

      const events: SwarmEvent[] = [];
      const { finalReport } = await runSwarm("task", (e) => events.push(e));

      // Worker fails with error event.
      expect(events.some((e) => e.type === "agent_done" && e.error)).toBe(true);
      // Synthesis still runs (with error note in output) and swarm completes.
      expect(events.some((e) => e.type === "swarm_done")).toBe(true);
      expect(finalReport).toContain("synth output");
    });
  });

  describe("SSE serialization", () => {
    it("serializes events as SSE data lines", async () => {
      const { serializeSSE } = await import("../swarm");
      const sse = serializeSSE({ type: "swarm_start", taskId: "abc" });
      expect(sse).toContain('data: {"type":"swarm_start"');
      expect(sse.endsWith("\n\n")).toBe(true);
    });
  });
});
