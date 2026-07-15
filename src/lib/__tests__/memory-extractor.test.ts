// Tests for memory-extractor.ts — extraction + storage.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LLM.
const mockSmart = vi.fn();
vi.mock("../llm-provider", () => ({
  getLLM: vi.fn(async () => ({
    provider: "nvidia",
    smartModels: ["model-1"],
    smart: mockSmart,
    fast: vi.fn(),
  })),
}));

// Mock embeddings.
vi.mock("../embeddings", () => ({
  embed: vi.fn(async () => ({ vector: [1, 2, 3], provider: "nvidia", dimensions: 3 })),
  embedBatch: vi.fn(async (texts: string[]) => texts.map(() => ({ vector: [1, 2, 3], provider: "nvidia", dimensions: 3 }))),
  getEmbeddingDimension: vi.fn(() => 1024),
  isEmbeddingAvailable: vi.fn(() => true),
  cosineSimilarity: vi.fn(() => 0.9),
}));

// Mock db.
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
      run: vi.fn(() => ({ changes: 1 })),
    })),
  })),
  isPostgresAvailable: vi.fn(() => false),
  getPrismaDb: vi.fn(async () => null),
}));

import { extractMemories, storeMemories, getMemories } from "../memory-extractor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractMemories", () => {
  it("extracts memories from valid LLM JSON response", async () => {
    mockSmart.mockResolvedValue({
      content: JSON.stringify([
        { type: "fact", content: "User works on RISC-V", confidence: 0.9 },
        { type: "preference", content: "User prefers Arabic", confidence: 0.85 },
      ]),
      tokensUsed: 50,
      model: "mock",
      provider: "nvidia",
    });

    const result = await extractMemories("User asked about RISC-V in Arabic");
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe("fact");
    expect(result[0]!.content).toBe("User works on RISC-V");
    expect(result[0]!.confidence).toBe(0.9);
  });

  it("returns empty array when LLM fails", async () => {
    mockSmart.mockRejectedValue(new Error("LLM down"));

    const result = await extractMemories("test content");
    expect(result).toHaveLength(0);
  });

  it("filters low-confidence memories (< 0.7)", async () => {
    mockSmart.mockResolvedValueOnce({
      content: JSON.stringify([
        { type: "fact", content: "High confidence", confidence: 0.9 },
        { type: "fact", content: "Low confidence", confidence: 0.5 },
      ]),
      tokensUsed: 30,
      model: "mock",
      provider: "nvidia",
    });

    const result = await extractMemories("test content for extraction");
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("High confidence");
  });

  it("returns empty for short content", async () => {
    const result = await extractMemories("ab");
    expect(result).toHaveLength(0);
  });

  it("returns empty for empty content", async () => {
    const result = await extractMemories("");
    expect(result).toHaveLength(0);
  });

  it("handles malformed JSON gracefully", async () => {
    mockSmart.mockResolvedValue({
      content: "not json at all",
      tokensUsed: 10,
      model: "mock",
      provider: "nvidia",
    });

    const result = await extractMemories("test content here");
    expect(result).toHaveLength(0);
  });
});

describe("storeMemories", () => {
  it("stores memories and returns count", async () => {
    const result = await storeMemories(null, [
      { type: "fact", content: "Test fact", confidence: 0.9 },
      { type: "preference", content: "Test pref", confidence: 0.8 },
    ]);
    expect(result).toBe(2);
  });

  it("returns 0 for empty memories array", async () => {
    const result = await storeMemories(null, []);
    expect(result).toBe(0);
  });
});

describe("getMemories", () => {
  it("returns array of memories", async () => {
    const result = await getMemories(null);
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters by type when provided", async () => {
    const result = await getMemories(null, "fact");
    expect(Array.isArray(result)).toBe(true);
  });
});
