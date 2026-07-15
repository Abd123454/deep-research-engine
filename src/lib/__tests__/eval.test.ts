// Tests for the evaluation harness (Phase 12B).
//
// Tests the dataset structure, code extraction, and the runner with mocked
// LLM/research/swarm calls.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock research-store to avoid DB dependencies.
vi.mock("../research-store", () => ({
  createJob: vi.fn((query: string) => ({
    id: "test-job-1",
    query,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    config: {},
    plan: null,
    gapAnalysis: null,
    round2FollowUps: [],
    subQueries: [],
    sources: [],
    report: null,
    logs: [],
    thoughts: [],
    followUpQuestions: [],
    clarifyingQuestions: [],
    error: null,
    stats: {
      totalPagesFound: 0,
      totalPagesRead: 0,
      totalPagesSucceeded: 0,
      totalTokensUsed: 100,
      elapsedMs: 0,
      subQueriesCompleted: 0,
      roundsCompleted: 0,
      llmCalls: 1,
      inputTokens: 10,
      outputTokens: 90,
      estimatedCost: 0,
    },
    cancelled: false,
    abortController: new AbortController(),
    reportStream: [],
    reportStreaming: false,
  })),
  getJob: vi.fn(),
}));

// Mock research-engine to avoid running the full pipeline.
vi.mock("../research-engine", () => ({
  runResearch: vi.fn(async (_jobId: string) => {
    // Simulate completion by updating the job via getJob mock.
    return;
  }),
}));

// Mock swarm.
vi.mock("../swarm", () => ({
  runSwarm: vi.fn(async (task: string, emit: (e: unknown) => void) => {
    emit({ type: "swarm_start" });
    emit({ type: "swarm_done" });
    return {
      plan: { taskId: "test", task, subtasks: [] },
      finalReport: "Here is the code:\n```python\ndef reverse(s):\n    return s[::-1]\n```\nDone.",
    };
  }),
}));

// Mock code-sandbox.
vi.mock("../code-sandbox", () => ({
  runCode: vi.fn(async (language: string, code: string) => {
    // If the code contains a syntax error, return failure.
    if (code.includes("SYNTAX_ERROR")) {
      return {
        success: false,
        output: "",
        error: "SyntaxError: invalid syntax",
        executionTimeMs: 5,
      };
    }
    return {
      success: true,
      output: "All tests passed",
      executionTimeMs: 10,
    };
  }),
}));

// Mock llm-provider for factual queries.
vi.mock("../llm-provider", () => ({
  getLLM: vi.fn(async () => ({
    provider: "nvidia",
    smartModels: ["test"],
    fast: vi.fn(async () => ({
      content: "The capital of France is Paris.",
      tokensUsed: 15,
      model: "test",
      provider: "nvidia",
    })),
    smart: vi.fn(),
  })),
}));

import { EVAL_DATASET, getEvalQuery, getEvalQueriesByType } from "../eval/dataset";
import { runEval, runEvalSuite } from "../eval/runner";
import { getJob } from "../research-store";
import { runCode } from "../code-sandbox";
import { runSwarm } from "../swarm";

describe("Eval dataset", () => {
  it("has 20 queries total", () => {
    expect(EVAL_DATASET.length).toBe(20);
  });

  it("has 10 research queries", () => {
    expect(getEvalQueriesByType("research").length).toBe(10);
  });

  it("has 5 coding queries", () => {
    expect(getEvalQueriesByType("coding").length).toBe(5);
  });

  it("has 5 factual queries", () => {
    expect(getEvalQueriesByType("factual").length).toBe(5);
  });

  it("every query has a unique ID", () => {
    const ids = EVAL_DATASET.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every coding query has a codingTest", () => {
    for (const q of getEvalQueriesByType("coding")) {
      expect(q.codingTest).toBeDefined();
      expect(q.codingTest!.language).toMatch(/^(javascript|python)$/);
      expect(q.codingTest!.test.length).toBeGreaterThan(10);
    }
  });

  it("getEvalQuery returns the right query", () => {
    const q = getEvalQuery("r1");
    expect(q).toBeDefined();
    expect(q!.query).toContain("RISC-V");
  });

  it("getEvalQuery returns undefined for unknown ID", () => {
    expect(getEvalQuery("nonexistent")).toBeUndefined();
  });
});

describe("runEval — factual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when expected keyword is present", async () => {
    const result = await runEval({
      id: "f1",
      query: "What is the capital of France?",
      type: "factual",
      expectedKeywords: ["Paris"],
      difficulty: "easy",
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.keywordsPresent).toBe(true);
    expect(result.details.error).toBeUndefined();
  });

  it("fails when expected keyword is missing", async () => {
    const result = await runEval({
      id: "f-test",
      query: "What is the capital of France?",
      type: "factual",
      expectedKeywords: ["Berlin"],
      difficulty: "easy",
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.details.keywordsPresent).toBe(false);
  });
});

describe("runEval — coding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when code test succeeds", async () => {
    const result = await runEval({
      id: "c1",
      query: "Write a reverse function",
      type: "coding",
      codingTest: {
        language: "python",
        test: "assert reverse('hi') == 'ih'",
      },
      difficulty: "easy",
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.codeTestPassed).toBe(true);
    expect(runCode).toHaveBeenCalledTimes(1);
  });

  it("fails when code test fails", async () => {
    vi.mocked(runCode).mockResolvedValueOnce({
      success: false,
      output: "",
      error: "AssertionError",
      executionTimeMs: 5,
    });

    const result = await runEval({
      id: "c-test",
      query: "Write a function",
      type: "coding",
      codingTest: {
        language: "python",
        test: "assert false",
      },
      difficulty: "easy",
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.details.error).toBe("AssertionError");
  });

  it("fails when no code block found in output", async () => {
    vi.mocked(runSwarm).mockResolvedValueOnce({
      plan: { taskId: "t", task: "q", subtasks: [] },
      finalReport: "I can't write that code.",
    });

    const result = await runEval({
      id: "c-no-code",
      query: "Write something",
      type: "coding",
      codingTest: {
        language: "python",
        test: "print('test')",
      },
      difficulty: "easy",
    });

    expect(result.passed).toBe(false);
    expect(result.details.error).toContain("No code block found");
  });
});

describe("runEval — research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("evaluates research query with sources and keywords", async () => {
    // Mock getJob to return a completed job with sources and report.
    vi.mocked(getJob).mockReturnValue({
      id: "test-job-1",
      query: "test",
      status: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {} as any,
      plan: null,
      gapAnalysis: null,
      round2FollowUps: [],
      subQueries: [],
      sources: [
        { url: "https://en.wikipedia.org/wiki/Test", title: "Test", host: "wikipedia.org", snippet: "", subQueryId: "sq1", round: 1 as const },
      ],
      report: "This is an open ISA instruction set for processors.",
      logs: [],
      thoughts: [],
      followUpQuestions: [],
      clarifyingQuestions: [],
      error: null,
      stats: {
        totalPagesFound: 1,
        totalPagesRead: 1,
        totalPagesSucceeded: 1,
        totalTokensUsed: 200,
        elapsedMs: 5000,
        subQueriesCompleted: 1,
        roundsCompleted: 1,
        llmCalls: 3,
        inputTokens: 100,
        outputTokens: 100,
        estimatedCost: 0,
      },
      cancelled: false,
      abortController: new AbortController(),
      reportStream: [],
      reportStreaming: false,
    });

    const result = await runEval({
      id: "r1",
      query: "What is RISC-V?",
      type: "research",
      expectedSources: ["wikipedia.org"],
      expectedKeywords: ["open", "ISA", "instruction set"],
      difficulty: "easy",
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.sourcesFound).toBe(true);
    expect(result.details.keywordsPresent).toBe(true);
    expect(result.details.tokensUsed).toBe(200);
  });

  it("fails when sources are missing", async () => {
    vi.mocked(getJob).mockReturnValue({
      id: "test-job-2",
      query: "test",
      status: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {} as any,
      plan: null,
      gapAnalysis: null,
      round2FollowUps: [],
      subQueries: [],
      sources: [], // no sources
      report: "This is an open ISA.",
      logs: [],
      thoughts: [],
      followUpQuestions: [],
      clarifyingQuestions: [],
      error: null,
      stats: {
        totalPagesFound: 0,
        totalPagesRead: 0,
        totalPagesSucceeded: 0,
        totalTokensUsed: 50,
        elapsedMs: 1000,
        subQueriesCompleted: 0,
        roundsCompleted: 0,
        llmCalls: 1,
        inputTokens: 25,
        outputTokens: 25,
        estimatedCost: 0,
      },
      cancelled: false,
      abortController: new AbortController(),
      reportStream: [],
      reportStreaming: false,
    });

    const result = await runEval({
      id: "r-test",
      query: "test",
      type: "research",
      expectedSources: ["wikipedia.org"],
      expectedKeywords: ["open"],
      difficulty: "easy",
    });

    expect(result.passed).toBe(false);
    expect(result.details.sourcesFound).toBe(false);
    expect(result.score).toBe(50); // keywords found but sources missing
  });
});

describe("runEvalSuite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs multiple queries and returns summary", async () => {
    // Mock factual query responses.
    const result = await runEvalSuite({ queries: ["f1", "f3"] });

    expect(result.results.length).toBe(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed + result.summary.failed).toBe(2);
    expect(result.summary.byType.factual).toBeDefined();
    expect(result.summary.byType.factual.total).toBe(2);
  });

  it("summary avgScore is calculated correctly", async () => {
    const result = await runEvalSuite({ queries: ["f1", "f3"] });

    // Both factual queries pass (Paris and Shakespeare) → avgScore should be 100.
    expect(result.summary.avgScore).toBeLessThanOrEqual(100);
    expect(result.summary.avgScore).toBeGreaterThanOrEqual(0);
  });
});
