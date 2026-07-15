// Tests for vision.ts — multimodal image understanding.
//
// Tesseract.js is mocked to prevent uncaught exceptions from its worker
// when given invalid base64 input. The mock returns a clean result.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tesseract.js — prevents worker uncaught exceptions on invalid base64.
vi.mock("tesseract.js", () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({
      data: { text: "mocked OCR text" },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Vision — OpenAI", () => {
  it("uses OpenAI Vision when OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.NVIDIA_API_KEY = "";

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: "A cat sitting on a table" } }],
      }), { status: 200 })
    );

    const { analyzeImage } = await import("../vision");
    const result = await analyzeImage("base64data", "image/png");

    expect(result.description).toBe("A cat sitting on a table");
    expect(result.provider).toBe("openai");
  });

  it("handles OpenAI API errors", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.NVIDIA_API_KEY = "";

    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const { analyzeImage } = await import("../vision");
    // Should fall through to Tesseract (which will fail with invalid base64).
    const result = await analyzeImage("base64data", "image/png");
    expect(result).toBeDefined();
    expect(result.provider).not.toBe("openai");
  }, 10000); // Tesseract fallback may take time.
});

describe("Vision — Anthropic fallback", () => {
  it("falls back to Anthropic when OpenAI not configured", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.NVIDIA_API_KEY = "";

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        content: [{ type: "text", text: "A dog in a park" }],
      }), { status: 200 })
    );

    const { analyzeImage } = await import("../vision");
    const result = await analyzeImage("base64data", "image/jpeg");

    expect(result.description).toBe("A dog in a park");
    expect(result.provider).toBe("anthropic");
  });
});

describe("Vision — NVIDIA fallback", () => {
  it("falls back to NVIDIA when OpenAI+Anthropic not configured", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.NVIDIA_API_KEY = "test-key";

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: "A car on a road" } }],
      }), { status: 200 })
    );

    const { analyzeImage } = await import("../vision");
    const result = await analyzeImage("base64data", "image/png");

    expect(result.description).toBe("A car on a road");
    expect(result.provider).toBe("nvidia");
  });
});

describe("Vision — no provider", () => {
  it("returns fallback when no vision API available", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.NVIDIA_API_KEY = "";

    const { analyzeImage } = await import("../vision");
    const result = await analyzeImage("base64data", "image/png");

    expect(result).toBeDefined();
    // Provider could be "tesseract" or "none" depending on env.
    expect(["tesseract", "none"]).toContain(result.provider);
  });
});

describe("Vision — custom prompt", () => {
  it("accepts custom prompt", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.NVIDIA_API_KEY = "";

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: "Custom analysis" } }],
      }), { status: 200 })
    );

    const { analyzeImage } = await import("../vision");
    const result = await analyzeImage("base64data", "image/png", "What colors are in this image?");

    expect(result.description).toBe("Custom analysis");
    // Verify the prompt was passed in the request body.
    const callBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(callBody.messages[0].content[0].text).toBe("What colors are in this image?");
  });
});
