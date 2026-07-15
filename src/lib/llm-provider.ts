// LLM provider — NVIDIA NIM (OpenAI-compatible Chat Completions).
//
// NVIDIA NIM is the ONLY external AI service used by this project.
// It provides access to a wide range of open models (Llama, Mistral,
// DeepSeek, Nemotron, MiniMax, Qwen, etc.) behind a single API.
//
// Get your FREE key from: https://build.nvidia.com/
//
// This module implements:
//   1. A 6-model fallback chain for "smart" calls (report writing,
//      analysis). If one model fails (429/503/timeout/404), the next
//      is tried, in order.
//   2. A single fast model for quick tasks (sub-question decomposition,
//      gap analysis).
//   3. Cooperative streaming: if a model emits at least one token before
//      failing, we do NOT fall back (the user has already seen partial
//      output). We surface the error instead.
//
// Search and page-reading use free/open tools (DuckDuckGo + Readability),
// so NVIDIA is the only service that requires a key.

import type { LLMProvider } from "./types";
import { env, envList } from "./env";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  // Hint that the model should produce structured JSON.
  json?: boolean;
  // If true, stream tokens via onToken instead of returning them all at once.
  stream?: boolean;
  onToken?: (token: string) => void;
  tools?: { name: string; description: string; parameters: { type: "object"; properties: Record<string, unknown>; required: string[] } }[];
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: LLMProvider;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
}

// ---------- Config from env ----------

export function getLLMProvider(): LLMProvider {
  return "nvidia";
}

// The 6-model smart fallback chain. Tried in order until one succeeds.
export function getSmartModels(): string[] {
  return envList(
    "SMART_LLM_MODELS",
    "meta/llama-3.1-70b-instruct,mistralai/mistral-nemotron,mistralai/mistral-small-4-119b-2603,minimaxai/minimax-m3,deepseek-ai/deepseek-v4-pro,mistralai/mistral-large-3-675b-instruct-2512"
  );
}

// Backward-compatible single model (first in the chain).
export function getSmartModel(): string {
  return getSmartModels()[0]!;
}

export function getFastModel(): string {
  return env("FAST_LLM", "meta/llama-3.1-8b-instruct");
}

export function getNvidiaBaseUrl(): string {
  return env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableLLMError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("503") ||
    m.includes("service unavailable") ||
    m.includes("timeout") ||
    m.includes("temporarily") ||
    m.includes("overloaded") ||
    m.includes("capacity")
  );
}

// Auth errors (401/403/invalid key) mean the SAME key is used for all 6
// models — retrying the next model is guaranteed to fail with the same
// error. Fast-fail to save time.
function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("api key") ||
    m.includes("401") ||
    m.includes("403") ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("invalid key") ||
    m.includes("nvidia_api_key") ||
    m.includes("not set")
  );
}

// Model-not-found errors (404) mean that specific model is unavailable —
// the next model in the chain might work, so continue.
function isModelError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("404") || m.includes("model not found") || m.includes("does not exist");
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 1
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Only retry once on rate-limit errors; the fallback chain handles the rest.
      if (attempt < retries && isRetryableLLMError(msg)) {
        await sleep(1000);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// Estimate token count for text that doesn't come with a usage object
// (NVIDIA streaming path). More accurate than chars/4 for non-English:
//   - CJK (Chinese/Japanese/Korean) + Arabic + Hebrew: ~2 chars/token
//   - Code symbols (brackets, operators): ~3.5 chars/token
//   - English/other: ~4 chars/token
function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0590-\u05ff]/g) || []).length;
  const codeChars = (text.match(/[{}[\]()<>=;|&!]/g) || []).length;
  const otherChars = text.length - cjkChars - codeChars;
  return Math.ceil(cjkChars / 2 + codeChars / 3.5 + otherChars / 4);
}

// ---------- NVIDIA NIM backend (OpenAI-compatible) ----------

interface NvidiaResponse {
  choices?: {
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
    };
  }[];
  usage?: { total_tokens?: number };
}

async function nvidiaCompleteSingle(
  opts: LLMCompletionOptions,
  model: string
): Promise<LLMCompletionResult> {
  const apiKey = env("NVIDIA_API_KEY");
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not set. Add your NVIDIA key to .env to use NVIDIA models."
    );
  }
  const baseUrl = getNvidiaBaseUrl();

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2048,
    top_p: 0.9,
    stream: opts.stream ?? false,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: opts.stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `NVIDIA NIM request failed (${res.status} ${res.statusText}): ${text.slice(
        0,
        300
      )}`
    );
  }

  // --- Streaming path: parse SSE chunks, call onToken for each ---
  if (opts.stream && res.body) {
    let fullContent = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;

        try {
          const chunk = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            opts.onToken?.(token);
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    return {
      content: fullContent,
      // NVIDIA streaming doesn't return a usage object. Estimate tokens
      // more accurately: CJK/Arabic/Hebrew ≈ 2 chars/token (complex scripts),
      // code symbols ≈ 3.5 chars/token, English/other ≈ 4 chars/token.
      tokensUsed: estimateTokens(fullContent),
      model,
      provider: "nvidia",
    };
  }

  // --- Non-streaming path ---
  const data = (await res.json()) as NvidiaResponse;
  const msg = data.choices?.[0]?.message;

  // Some reasoning models return content=null and put the output in
  // reasoning_content / reasoning. Handle both.
  let content = msg?.content ?? "";
  if (!content && (msg?.reasoning_content || msg?.reasoning)) {
    content = msg.reasoning_content || msg.reasoning || "";
  }

  return {
    content,
    tokensUsed: data.usage?.total_tokens,
    model,
    provider: "nvidia",
  };
}

// Try each model in the fallback chain. For retryable errors (429/503/timeout),
// retry with backoff. For hard errors (404/400/500), skip to the next model.
//
// If streaming and at least one token was already emitted via onToken, do NOT
// fallback — the user has already seen partial output. Emit the error instead.
async function nvidiaCompleteWithFallback(
  opts: LLMCompletionOptions,
  models: string[]
): Promise<LLMCompletionResult> {
  let lastErr: unknown;
  const tried: string[] = [];
  let tokensEmitted = false;

  const originalOnToken = opts.onToken;
  const wrappedOpts: LLMCompletionOptions = {
    ...opts,
    onToken: (token: string) => {
      tokensEmitted = true;
      originalOnToken?.(token);
    },
  };

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    tried.push(model);

    if (opts.stream && tokensEmitted) {
      throw new Error(
        `Streaming failed mid-stream after ${model} emitted tokens. ` +
          "Cannot fallback — partial report was already shown to the user. " +
          `Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
      );
    }

    try {
      const result = await withRetry(
        () => nvidiaCompleteSingle(wrappedOpts, model),
        `nvidia:${model}`,
        1
      );
      if (i > 0) {
        console.log(
          `[llm-provider] SMART_LLM fallback: "${model}" succeeded after ${i} previous model(s) failed.`
        );
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (tokensEmitted) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      // Fast-fail on auth errors: the same NVIDIA_API_KEY is used for all
      // models, so the next model will fail with the same error. Don't
      // waste time trying 5 more models.
      if (isAuthError(msg)) {
        throw new Error(
          `NVIDIA_API_KEY invalid or expired. Skipping fallback chain. ` +
            `First model "${model}" error: ${msg}`
        );
      }
      // Model errors (404) → continue to next model.
      // Retryable errors (429/503) → already retried by withRetry, continue.
      // Other errors → continue to next model (might be model-specific).
      console.warn(
        `[llm-provider] Model "${model}" failed: ${msg.slice(0, 120)}. -> next model`
      );
    }
  }

  // All NVIDIA models failed — try cross-provider fallback before giving up.
  const triedStr = tried.join(", ");
  console.warn(
    `[llm-provider] All ${models.length} NVIDIA models failed (tried: ${triedStr}). ` +
      `Attempting cross-provider fallback (OpenAI → Anthropic → Ollama).`
  );
  return await crossProviderFallback(opts, lastErr);
}

// ---------- Cross-provider fallback ----------
// When all NVIDIA models fail (or NVIDIA_API_KEY is missing/invalid), try
// the other configured providers in order: OpenAI → Anthropic → Ollama.
//
// This is what makes the project resilient to NVIDIA outages. Each provider
// is dynamically imported so that a missing dependency doesn't break the
// NVIDIA-only path.
//
// If streaming tokens were already emitted to the caller, we do NOT fallback
// (the caller already saw partial output). The caller (nvidiaCompleteWithFallback)
// checks this before calling us.

async function crossProviderFallback(
  opts: LLMCompletionOptions,
  nvidiaErr: unknown
): Promise<LLMCompletionResult> {
  const nvidiaMsg = nvidiaErr instanceof Error ? nvidiaErr.message : String(nvidiaErr);
  const triedProviders: string[] = ["nvidia"];

  // 1. OpenAI
  if (env("OPENAI_API_KEY")) {
    try {
      const { OpenAIProvider } = await import("./llm-providers/openai");
      const provider = new OpenAIProvider();
      const result = await provider.smart(opts);
      console.log("[llm-provider] Cross-provider fallback succeeded via OpenAI.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] OpenAI fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("openai");
    }
  }

  // 2. Anthropic
  if (env("ANTHROPIC_API_KEY")) {
    try {
      const { AnthropicProvider } = await import("./llm-providers/anthropic");
      const provider = new AnthropicProvider();
      const result = await provider.smart(opts);
      console.log("[llm-provider] Cross-provider fallback succeeded via Anthropic.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] Anthropic fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("anthropic");
    }
  }

  // 3. Ollama (local — always worth trying if URL is set)
  if (env("OLLAMA_URL")) {
    try {
      const { OllamaProvider } = await import("./llm-providers/ollama");
      const provider = new OllamaProvider();
      const result = await provider.smart(opts);
      console.log("[llm-provider] Cross-provider fallback succeeded via Ollama.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] Ollama fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("ollama");
    }
  }

  // All providers failed.
  throw new Error(
    `All LLM providers failed. Tried: ${triedProviders.join(" → ")}. ` +
      `NVIDIA error: ${nvidiaMsg.slice(0, 200)}`
  );
}

// Fast model: single model (no fallback needed within NVIDIA).
// Falls back to cross-provider if NVIDIA fast model fails.
async function nvidiaFast(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  try {
    return await withRetry(
      () => nvidiaCompleteSingle(opts, getFastModel()),
      `nvidia-fast:${getFastModel()}`,
      3
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If NVIDIA fast fails with auth error and we have other providers, try them.
    if (env("OPENAI_API_KEY") || env("ANTHROPIC_API_KEY") || env("OLLAMA_URL")) {
      console.warn(
        `[llm-provider] NVIDIA fast model failed (${msg.slice(0, 80)}). Trying cross-provider fast fallback.`
      );
      return await crossProviderFastFallback(opts, err);
    }
    throw err;
  }
}

// Cross-provider fallback for the fast() path (mirrors crossProviderFallback
// but uses each provider's fast() method instead of smart()).
async function crossProviderFastFallback(
  opts: LLMCompletionOptions,
  nvidiaErr: unknown
): Promise<LLMCompletionResult> {
  const nvidiaMsg = nvidiaErr instanceof Error ? nvidiaErr.message : String(nvidiaErr);
  const triedProviders: string[] = ["nvidia"];

  if (env("OPENAI_API_KEY")) {
    try {
      const { OpenAIProvider } = await import("./llm-providers/openai");
      const provider = new OpenAIProvider();
      const result = await provider.fast(opts);
      console.log("[llm-provider] Cross-provider fast fallback succeeded via OpenAI.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] OpenAI fast fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("openai");
    }
  }

  if (env("ANTHROPIC_API_KEY")) {
    try {
      const { AnthropicProvider } = await import("./llm-providers/anthropic");
      const provider = new AnthropicProvider();
      const result = await provider.fast(opts);
      console.log("[llm-provider] Cross-provider fast fallback succeeded via Anthropic.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] Anthropic fast fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("anthropic");
    }
  }

  if (env("OLLAMA_URL")) {
    try {
      const { OllamaProvider } = await import("./llm-providers/ollama");
      const provider = new OllamaProvider();
      const result = await provider.fast(opts);
      console.log("[llm-provider] Cross-provider fast fallback succeeded via Ollama.");
      return { ...result, provider: result.provider as unknown as LLMProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-provider] Ollama fast fallback failed: ${msg.slice(0, 120)}`);
      triedProviders.push("ollama");
    }
  }

  throw new Error(
    `All LLM providers failed (fast path). Tried: ${triedProviders.join(" → ")}. ` +
      `NVIDIA error: ${nvidiaMsg.slice(0, 200)}`
  );
}

// ---------- Public API ----------

export interface LLMProviderApi {
  fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  provider: LLMProvider;
  smartModels: string[];
}

export async function getLLM(): Promise<LLMProviderApi> {
  const smartModels = getSmartModels();
  return {
    provider: "nvidia",
    smartModels,
    fast: nvidiaFast,
    smart: (opts) => nvidiaCompleteWithFallback(opts, smartModels),
  };
}
