// Tests for llm-provider.ts — NVIDIA NIM backend, fallback chain,
// auth fast-fail, token estimation, streaming.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global.fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Import after mocking fetch
import {
  getLLM,
  getSmartModels,
  getFastModel,
} from "../llm-provider";
import { clearPromptCache } from "../prompt-cache";

beforeEach(() => {
  fetchMock.mockReset();
  // Clear the in-process prompt cache so tests don't leak cached
  // results into each other (P0-10 wired the cache into
  // nvidiaCompleteSingle — without this, a passing test that wrote
  // to the cache could mask a fetch-mock assertion in the next test).
  clearPromptCache();
  // Set env for tests
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
  process.env.SMART_LLM_MODELS = "model-1,model-2,model-3";
  process.env.FAST_LLM = "fast-model";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- nvidiaCompleteSingle (via getLLM().smart / .fast) ----------

describe("LLM completion — non-streaming", () => {
  it("returns content on 200 OK", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Hello from NVIDIA" } }],
          usage: { total_tokens: 42 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 100,
    });

    expect(result.content).toBe("Hello from NVIDIA");
    expect(result.tokensUsed).toBe(42);
    expect(result.provider).toBe("nvidia");
  });

  it("throws on 401 Unauthorized", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const _llm = await getLLM();
    // With only 1 model, auth error should fast-fail immediately.
    process.env.SMART_LLM_MODELS = "model-1";
    const llm1 = await getLLM();

    await expect(
      llm1.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/invalid|expired|Unauthorized|401/i);
  });

  it("throws on 500 server error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    process.env.SMART_LLM_MODELS = "model-1";
    const llm = await getLLM();
    await expect(
      llm.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/500|Internal Server Error/i);
  });

  it("throws on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    process.env.SMART_LLM_MODELS = "model-1";
    const llm = await getLLM();
    await expect(
      llm.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/fetch failed/i);
  });
});

// ---------- Streaming ----------

describe("LLM completion — streaming", () => {
  it("calls onToken for each SSE chunk", async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const tokens: string[] = [];
    process.env.SMART_LLM_MODELS = "model-1";
    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
      onToken: (t: string) => tokens.push(t),
    });

    expect(tokens).toEqual(["Hello", " world"]);
    expect(result.content).toBe("Hello world");
  });
});

// ---------- Fallback chain ----------

describe("nvidiaCompleteWithFallback", () => {
  it("succeeds on first model without fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Success" } }],
          usage: { total_tokens: 10 },
        }),
        { status: 200 }
      )
    );

    process.env.SMART_LLM_MODELS = "model-1,model-2,model-3";
    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to next model on 404 (model not found)", async () => {
    // First model: 404
    fetchMock.mockResolvedValueOnce(
      new Response("Model not found", { status: 404 })
    );
    // Second model: success
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Fallback success" } }],
          usage: { total_tokens: 20 },
        }),
        { status: 200 }
      )
    );

    process.env.SMART_LLM_MODELS = "model-1,model-2";
    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Fallback success");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fast-fails on auth error (does not try remaining models)", async () => {
    // First model: 401
    fetchMock.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    process.env.SMART_LLM_MODELS = "model-1,model-2,model-3";
    const llm = await getLLM();
    await expect(
      llm.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/invalid|expired|Unauthorized|401|Skipping/i);

    // Should NOT have tried model-2 or model-3
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when all models fail", async () => {
    // All models return 500
    fetchMock.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    process.env.SMART_LLM_MODELS = "model-1,model-2";
    // Clear other provider keys so cross-provider fallback isn't attempted.
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OLLAMA_URL;
    const llm = await getLLM();
    // After Round 11 wiring: all NVIDIA models fail → cross-provider fallback
    // → no other provider available → throws "All LLM providers failed".
    await expect(
      llm.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/All (LLM providers|.*models).*failed/i);
  });
});

// ---------- Config functions ----------

describe("config functions", () => {
  it("getSmartModels returns env-configured models", () => {
    process.env.SMART_LLM_MODELS = "alpha,beta,gamma";
    const models = getSmartModels();
    expect(models).toEqual(["alpha", "beta", "gamma"]);
  });

  it("getFastModel returns env-configured fast model", () => {
    process.env.FAST_LLM = "my-fast-model";
    expect(getFastModel()).toBe("my-fast-model");
  });

  it("getSmartModels falls back to defaults when env not set", () => {
    delete process.env.SMART_LLM_MODELS;
    const models = getSmartModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toBeTruthy();
  });
});

// ---------- Token estimation (via streaming result) ----------

describe("token estimation", () => {
  it("estimates tokens for English text", async () => {
    const englishText = "Hello world this is a test";
    const sseChunks = [
      `data: {"choices":[{"delta":{"content":"${englishText}"}}]}\n\n`,
      "data: [DONE]\n\n",
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    process.env.SMART_LLM_MODELS = "model-1";
    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    });

    // ~4 chars/token for English, so 26 chars ≈ 7 tokens
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.tokensUsed).toBeLessThan(20);
  });

  it("estimates more tokens for Arabic text (2 chars/token)", async () => {
    const arabicText = "مرحبا بالعالم هذا اختبار";
    const sseChunks = [
      `data: {"choices":[{"delta":{"content":"${arabicText}"}}]}\n\n`,
      "data: [DONE]\n\n",
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    process.env.SMART_LLM_MODELS = "model-1";
    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    });

    // Arabic ≈ 2 chars/token, so ~24 chars ≈ 12 tokens
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

// ---------- Missing API key ----------

describe("missing API key", () => {
  it("throws when NVIDIA_API_KEY is not set", async () => {
    delete process.env.NVIDIA_API_KEY;
    process.env.SMART_LLM_MODELS = "model-1";

    const llm = await getLLM();
    await expect(
      llm.smart({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(/NVIDIA_API_KEY/i);
  });
});
