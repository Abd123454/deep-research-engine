// Tests for cross-provider fallback (Round 11 wiring).
//
// Verifies that when all NVIDIA models fail, the LLM provider falls back
// to OpenAI → Anthropic → Ollama, and that when no provider is available
// it throws a clear error.
//
// NOTE: vitest v4 requires regular functions (not arrow) for mockImplementation
// when the mock is used as a constructor with `new`. Arrow functions throw
// "X is not a constructor".

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------- Mock the provider modules ----------
vi.mock("../llm-providers/openai", () => ({
  OpenAIProvider: vi.fn(),
}));
vi.mock("../llm-providers/anthropic", () => ({
  AnthropicProvider: vi.fn(),
}));
vi.mock("../llm-providers/ollama", () => ({
  OllamaProvider: vi.fn(),
}));

// Mock env so we can control which providers are "configured".
vi.mock("../env", () => ({
  env: vi.fn((key: string, fallback = "") => fallback),
  envList: vi.fn((_key: string, fallback = "") =>
    fallback ? fallback.split(",") : []
  ),
}));

import { getLLM } from "../llm-provider";
import { env } from "../env";
import { OpenAIProvider } from "../llm-providers/openai";
import { AnthropicProvider } from "../llm-providers/anthropic";
import { OllamaProvider } from "../llm-providers/ollama";

function makeProviderResult(provider: string, content: string) {
  return {
    content,
    tokensUsed: 10,
    model: "test-model",
    provider,
    cost: 0,
  };
}

// Helper: set up a provider constructor mock that returns the given instance.
// MUST use a regular function (not arrow) because it's called with `new`.
function mockProviderConstructor(
  fn: ReturnType<typeof vi.fn>,
  instance: Record<string, unknown>
) {
  fn.mockImplementation(function () {
    return instance;
  });
}

describe("Cross-provider fallback (Round 11 wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default env: no providers configured.
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => fallback);

    // Default providers: empty objects (tests override).
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, {});
    mockProviderConstructor(AnthropicProvider as ReturnType<typeof vi.fn>, {});
    mockProviderConstructor(OllamaProvider as ReturnType<typeof vi.fn>, {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to OpenAI when NVIDIA fails and OPENAI_API_KEY is set", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "invalid-nvidia-key",
        OPENAI_API_KEY: "sk-test-openai",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    const openaiInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("openai", "OpenAI fallback success")),
      fast: vi.fn(),
    };
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);

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
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);
    mockProviderConstructor(AnthropicProvider as ReturnType<typeof vi.fn>, anthropicInstance);

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
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);
    mockProviderConstructor(AnthropicProvider as ReturnType<typeof vi.fn>, anthropicInstance);
    mockProviderConstructor(OllamaProvider as ReturnType<typeof vi.fn>, ollamaInstance);

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
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);
    mockProviderConstructor(AnthropicProvider as ReturnType<typeof vi.fn>, anthropicInstance);

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
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);

    const llm = await getLLM();
    const tokens: string[] = [];
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
      stream: true,
      onToken: (t: string) => tokens.push(t),
    });

    expect(result.content).toContain("partial");
    expect(openaiInstance.smart).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("falls back to OpenAI on NVIDIA 401 auth error (not 500)", async () => {
    (env as ReturnType<typeof vi.fn>).mockImplementation((key: string, fallback = "") => {
      const vals: Record<string, string> = {
        NVIDIA_API_KEY: "revoked-nvidia-key",
        OPENAI_API_KEY: "sk-test-openai",
        SMART_LLM_MODELS: "meta/llama-3.1-70b-instruct",
      };
      return vals[key] ?? fallback;
    });

    const openaiInstance = {
      smart: vi.fn().mockResolvedValue(makeProviderResult("openai", "OpenAI via 401 fallback")),
      fast: vi.fn(),
    };
    mockProviderConstructor(OpenAIProvider as ReturnType<typeof vi.fn>, openaiInstance);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid API Key" }), {
        status: 401,
        statusText: "Unauthorized",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = await getLLM();
    const result = await llm.smart({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("OpenAI via 401 fallback");
    expect(result.provider).toBe("openai");
    expect(openaiInstance.smart).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
