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
  role: "system" | "user" | "assistant";
  content: string;
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
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: LLMProvider;
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
      tokensUsed: undefined,
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
      console.warn(
        `[llm-provider] Model "${model}" failed: ${msg.slice(0, 120)}. -> next model`
      );
    }
  }

  const triedStr = tried.join(", ");
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `All ${models.length} NVIDIA models failed. Tried: ${triedStr}. Last error: ${msg}`
  );
}

// Fast model: single model (no fallback needed).
async function nvidiaFast(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  return withRetry(
    () => nvidiaCompleteSingle(opts, getFastModel()),
    `nvidia-fast:${getFastModel()}`,
    3
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
