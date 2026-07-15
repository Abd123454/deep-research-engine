// Tests for embeddings.ts — NVIDIA/OpenAI fallback, chunking, cosine similarity.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  embed,
  embedBatch,
  getEmbeddingDimension,
  isEmbeddingAvailable,
  cosineSimilarity,
} from "../embeddings";

beforeEach(() => {
  fetchMock.mockReset();
  process.env.NVIDIA_API_KEY = "test-nvidia-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- embed ----------

describe("embed", () => {
  it("returns NVIDIA embedding when NVIDIA_API_KEY is set", async () => {
    const mockVector = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ embedding: mockVector }] }), { status: 200 })
    );

    const result = await embed("test text");
    expect(result.provider).toBe("nvidia");
    expect(result.dimensions).toBe(1024);
    expect(result.vector.length).toBe(1024);
  });

  it("falls back to OpenAI when NVIDIA fails", async () => {
    // NVIDIA fails (401).
    fetchMock.mockImplementationOnce(async () =>
      new Response("Unauthorized", { status: 401 })
    );
    // OpenAI succeeds.
    const mockVector = Array.from({ length: 1536 }, (_, i) => i * 0.001);
    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ data: [{ embedding: mockVector }] }), { status: 200 })
    );

    const result = await embed("test text");
    expect(result.provider).toBe("openai");
    expect(result.dimensions).toBe(1536);
  });

  it("returns empty when both providers fail", async () => {
    fetchMock.mockImplementation(async () =>
      new Response("Error", { status: 500 })
    );

    const result = await embed("test text");
    expect(result.provider).toBe("none");
    expect(result.vector.length).toBe(0);
  });

  it("returns empty for empty text", async () => {
    const result = await embed("");
    expect(result.provider).toBe("none");
    expect(result.vector.length).toBe(0);
  });

  it("returns empty for whitespace-only text", async () => {
    const result = await embed("   ");
    expect(result.provider).toBe("none");
    expect(result.vector.length).toBe(0);
  });
});

// ---------- embedBatch ----------

describe("embedBatch", () => {
  it("embeds multiple texts", async () => {
    const mockVector = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: mockVector }] }), { status: 200 })
    );

    const results = await embedBatch(["text 1", "text 2", "text 3"]);
    expect(results).toHaveLength(3);
    expect(results[0]!.vector.length).toBe(1024);
  });

  it("handles empty array", async () => {
    const results = await embedBatch([]);
    expect(results).toHaveLength(0);
  });
});

// ---------- getEmbeddingDimension ----------

describe("getEmbeddingDimension", () => {
  it("returns 1024 when NVIDIA is configured", () => {
    process.env.NVIDIA_API_KEY = "key";
    expect(getEmbeddingDimension()).toBe(1024);
  });

  it("returns 1536 when only OpenAI is configured", () => {
    delete process.env.NVIDIA_API_KEY;
    process.env.OPENAI_API_KEY = "key";
    expect(getEmbeddingDimension()).toBe(1536);
  });

  it("returns 0 when no provider is configured", () => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(getEmbeddingDimension()).toBe(0);
  });
});

// ---------- isEmbeddingAvailable ----------

describe("isEmbeddingAvailable", () => {
  it("returns true when NVIDIA is set", () => {
    expect(isEmbeddingAvailable()).toBe(true);
  });

  it("returns false when no providers are set", () => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(isEmbeddingAvailable()).toBe(false);
  });
});

// ---------- cosineSimilarity ----------

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("handles negative values", () => {
    const a = [1, -1];
    const b = [-1, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });
});
