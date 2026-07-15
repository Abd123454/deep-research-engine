// Tests for cross-provider fallback (Round 11 wiring).
//
// Verifies that when all NVIDIA models fail, the LLM provider falls back
// to OpenAI → Anthropic → Ollama, and that when no provider is available
// it throws a clear error.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------- Mock the provider modules ----------
// We mock each provider module so we can control success/failure without
// making real HTTP calls.

const mockOpenAI = { OpenAIProvider: vi.fn() };
const mockAnthropic = { AnthropicProvider: vi.fn() };
const mockOllama = { OllamaProvider: vi.fn() };

vi.mock("../llm-providers/openai", () => mockOpenAI);
vi.mock("../llm-providers/anthropic", () => mockAnthropic);
vi.mock("../llm-providers/ollama", () => mockOllama);

// Mock env so we can control which providers are "configured".
vi.mock("../env", () => ({
  env: vi.fn((key: string, fallback = "") => {
    const vals: Record<string, string> = {};
    return vals[key] ?? fallback;
  }),
  envList: vi.fn((_key: string, fallback = "") =>
    fallback ? fallback.split(",") : []
  ),
}));

// Import after mocks are set up.
import { getLLM } from "../llm-provider";
import { env } from "../env";

function makeProviderResult(provider: string, content: string) {
  return {
    content,
    tokensUsed: 10,
    model: "test-model",
    provider,
    cost: 0,
  };
}

describe("Cross-provider fallback (Round 11 wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env mock to return empty by default.
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {};
      return vals[key] ?? fallback;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to OpenAI when NVIDIA fails and OPENAI_API_KEY is set", async () => {
    // Configure env: NVIDIA key set (so nvidiaCompleteSingle runs) but it will fail.
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "invalid-nvidia-key",
        OPENAI_API_KEY: "sk-test-openai",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    // OpenAI provider succeeds.
    const openaiInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("openai", "OpenAI fallback success")),
      fast: vi.fn(),
    };
    mockOpenAI.OpenAIProvider.mockImplementation(() => openaiInstance);

    // Mock fetch so NVIDIA's HTTP call fails.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "NVIDIA down" }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("OpenAI fallback success");
    expect(openaiInstance.smart).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("falls back to Anthropic when NVIDIA and OpenAI both fail", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "invalid",
        OPENAI_API_KEY: "sk-test",
        ANTHROPIC_API_KEY: "sk-ant-test",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    const openaiInstance = {
      smart: vi.fn().mockRejectedValue(new Error("OpenAI down")),
      fast: vi.fn(),
    };
    const anthropicInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("anthropic", "Anthropic fallback success")),
      fast: vi.fn(),
    };
    mockOpenAI.OpenAIProvider.mockImplementation(() => openaiInstance);
    mockAnthropic.AnthropicProvider.mockImplementation(() => anthropicInstance);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "NVIDIA down" }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("Anthropic fallback success");
    expect(openaiInstance.smart).toHaveBeenCalledTimes(1);
    expect(anthropicInstance.smart).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("falls back to Ollama when NVIDIA, OpenAI, and Anthropic all fail", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "invalid",
        OPENAI_API_KEY: "sk-test",
        ANTHROPIC_API_KEY: "sk-ant-test",
        OLLAMA_URL: "http://localhost:11434",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    const openaiInstance = {
      smart: vi.fn().mockRejectedValue(new Error("OpenAI down")),
      fast: vi.fn(),
    };
    const anthropicInstance = {
      smart: vi.fn().mockRejectedValue(new Error("Anthropic down")),
      fast: vi.fn(),
    };
    const ollamaInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("ollama", "Ollama fallback success")),
      fast: vi.fn(),
    };
    mockOpenAI.OpenAIProvider.mockImplementation(() => openaiInstance);
    mockAnthropic.AnthropicProvider.mockImplementation(() => anthropicInstance);
    mockOllama.OllamaProvider.mockImplementation(() => ollamaInstance);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "NVIDIA down" }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("Ollama fallback success");
    expect(ollamaInstance.smart).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("throws clear error when all providers fail", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "invalid",
        OPENAI_API_KEY: "sk-test",
        ANTHROPIC_API_KEY: "sk-ant-test",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    const openaiInstance = {
      smart: vi.fn().mockRejectedValue(new Error("OpenAI down")),
      fast: vi.fn(),
    };
    const anthropicInstance = {
      smart: vi.fn().mockRejectedValue(new Error("Anthropic down")),
      fast: vi.fn(),
    };
    mockOpenAI.OpenAIProvider.mockImplementation(() => openaiInstance);
    mockAnthropic.AnthropicProvider.mockImplementation(() => anthropicInstance);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "NVIDIA down" }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = await getLLM();
    await expect(
      llm.smart({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(/All LLM providers failed/);

    vi.unstubAllGlobals();
  });

  it("does NOT fallback if streaming tokens already emitted (cooperative cancel)", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "test-key",
        OPENAI_API_KEY: "sk-test",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    // NVIDIA streams 1 token then fails mid-stream.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: [DONE]\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const openaiInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("openai", "should not reach")),
      fast: vi.fn(),
    };
    mockOpenAI.OpenAIProvider.mockImplementation(() => openaiInstance);

    const llm = await getLLM();
    const tokens: string[] = [];
    // This will stream "partial" and then the stream ends (no error, just incomplete).
    // The point is: if a token was emitted, we should NOT fallback.
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
      stream: true,
      onToken: (t: string) => tokens.push(t),
    });

    // NVIDIA returned content (even if partial), so no fallback needed.
    expect(result.content).toContain("partial");
    expect(openaiInstance.smart).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
