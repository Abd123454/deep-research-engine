// Tests for memory-recall.ts — semantic search, injection, boosting.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock embeddings.
vi.mock("../embeddings", () => ({
  embed: vi.fn(),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    return (Math.sqrt(normA) * Math.sqrt(normB)) === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }),
}));

// Mock db.
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
      run: vi.fn(() => ({ changes: 0 })),
    })),
  })),
  isPostgresAvailable: vi.fn(() => false),
  getPrismaDb: vi.fn(async () => null),
}));

import { recallRelevantMemories, injectMemoriesIntoPrompt, recallAndInject } from "../memory-recall";
import { embed } from "../embeddings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("injectMemoriesIntoPrompt", () => {
  it("appends memories to system prompt", () => {
    const sys = "You are a helpful assistant.";
    const memories = [
      { id: "1", type: "fact", content: "User works on RISC-V", confidence: 0.9, similarity: 0.85, score: 0.9, createdAt: "2025-01-01", lastAccessed: null },
      { id: "2", type: "preference", content: "User prefers Arabic", confidence: 0.8, similarity: 0.75, score: 0.8, createdAt: "2025-01-02", lastAccessed: null },
    ];
    const result = injectMemoriesIntoPrompt(sys, memories);
    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("RELEVANT MEMORIES");
    expect(result).toContain("User works on RISC-V");
    expect(result).toContain("User prefers Arabic");
    expect(result).toContain("[fact]");
    expect(result).toContain("[preference]");
  });

  it("returns original prompt when no memories", () => {
    const sys = "You are a helpful assistant.";
    const result = injectMemoriesIntoPrompt(sys, []);
    expect(result).toBe(sys);
  });

  it("includes confidence scores", () => {
    const memories = [
      { id: "1", type: "fact", content: "Test", confidence: 0.95, similarity: 0.9, score: 0.9, createdAt: "2025-01-01", lastAccessed: null },
    ];
    const result = injectMemoriesIntoPrompt("sys", memories);
    expect(result).toContain("0.95");
  });
});

describe("recallRelevantMemories", () => {
  it("returns empty for short queries", async () => {
    const result = await recallRelevantMemories(null, "ab");
    expect(result).toHaveLength(0);
  });

  it("returns empty for empty query", async () => {
    const result = await recallRelevantMemories(null, "");
    expect(result).toHaveLength(0);
  });

  it("calls embed for the query", async () => {
    vi.mocked(embed).mockResolvedValue({ vector: [1, 2, 3], provider: "nvidia", dimensions: 3 });
    await recallRelevantMemories(null, "quantum computing research");
    expect(embed).toHaveBeenCalledWith("quantum computing research");
  });
});

describe("recallAndInject", () => {
  it("returns original prompt when no memories recalled", async () => {
    vi.mocked(embed).mockResolvedValue({ vector: [1, 2, 3], provider: "nvidia", dimensions: 3 });
    const result = await recallAndInject(null, "test query", "system prompt");
    expect(result).toBe("system prompt");
  });

  it("injects memories when recalled", async () => {
    vi.mocked(embed).mockResolvedValue({ vector: [1, 2, 3], provider: "nvidia", dimensions: 3 });
    // Mock SQLite to return a memory.
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn(() => ({
        all: vi.fn(() => [{
          id: "1",
          type: "fact",
          content: "User likes quantum physics",
          confidence: 0.9,
          created_at: "2025-01-01",
          last_accessed: null,
          access_count: 2,
        }]),
        get: vi.fn(() => undefined),
        run: vi.fn(() => ({ changes: 0 })),
      })),
    } as any);

    const result = await recallAndInject(null, "quantum computing", "system prompt");
    expect(result).toContain("User likes quantum physics");
    expect(result).toContain("RELEVANT MEMORIES");
  });
});
