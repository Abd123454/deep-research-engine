// LLM Provider abstraction with multi-model fallback chain.
//
// Supports two backends:
//   1. "zai"     -> built-in z-ai-web-dev-sdk (FREE, no key needed in this env)
//   2. "nvidia"  -> NVIDIA NIM (OpenAI-compatible endpoint) with 6-model fallback
//
// The NVIDIA backend reads SMART_LLM_MODELS (comma-separated list) and tries
// each model in order until one succeeds. This provides resilience against
// individual model outages, rate limits, or timeouts.

import ZAI from "z-ai-web-dev-sdk";
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
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: LLMProvider;
}

// ---------- Config from env ----------

export function getLLMProvider(): LLMProvider {
  const v = env("LLM_PROVIDER", "zai").toLowerCase();
  // Auto-fallback to zai if NVIDIA selected but no key configured.
  if (v === "nvidia" && !env("NVIDIA_API_KEY")) {
    return "zai";
  }
  return v === "nvidia" ? "nvidia" : "zai";
}

// The 6 smart models (fallback chain). Tries each in order.
export function getSmartModels(): string[] {
  return envList(
    "SMART_LLM_MODELS",
    "mistralai/mistral-large-3-675b-instruct-2512,deepseek-ai/deepseek-v4-pro,mistralai/mistral-nemotron,meta/llama-3.1-70b-instruct,minimaxai/minimax-m3,mistralai/mistral-small-4-119b-2603"
  );
}

// Backward-compatible single model (first in the chain).
export function getSmartModel(): string {
  return getSmartModels()[0];
}

export function getFastModel(): string {
  return env("FAST_LLM", "meta/llama-3.1-8b-instruct");
}

export function getNvidiaBaseUrl(): string {
  return env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
}

// ---------- Z.AI backend ----------

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
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

// Should we skip to the next model in the fallback chain (vs. retry)?
// (shouldSkipModel was removed — the fallback loop now skips to the next model
// on ANY error after exhausting retries, so a separate hard-error classifier
// is no longer needed.)

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
        await sleep(1000); // short 1s backoff, only once
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

async function zaiComplete(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  return withRetry(async () => {
    const zai = await getZAI();
    // ZAI SDK uses 'assistant' role for the system prompt (per their docs).
    const messages = opts.messages.map((m) =>
      m.role === "system"
        ? { role: "assistant" as const, content: m.content }
        : { role: m.role as "user" | "assistant", content: m.content }
    );

    if (opts.json) {
      messages.push({
        role: "user",
        content:
          "\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no commentary, no preamble.",
      });
    }

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });

    const content = completion.choices[0]?.message?.content ?? "";

    return {
      content,
      tokensUsed: (completion as { usage?: { total_tokens?: number } }).usage
        ?.total_tokens,
      model: "zai-built-in",
      provider: "zai" as const,
    };
  }, "zaiComplete");
}

// ---------- NVIDIA NIM backend (OpenAI-compatible) with fallback chain ----------

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
    stream: false,
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
      Accept: "application/json",
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

  const data = (await res.json()) as NvidiaResponse;
  const msg = data.choices?.[0]?.message;

  // Some reasoning models (e.g., gpt-oss, nemotron-super) return content=null
  // and put the actual output in `reasoning_content` or `reasoning`. Handle both.
  let content = msg?.content ?? "";
  if (!content && (msg?.reasoning_content || msg?.reasoning)) {
    content = msg.reasoning_content || msg.reasoning || "";
  }

  return {
    content,
    tokensUsed: data.usage?.total_tokens,
    model,
    provider: "nvidia" as const,
  };
}

// Try each model in the fallback chain. For retryable errors (429/503/timeout),
// retry with backoff. For hard errors (404/400/500), skip to the next model.
async function nvidiaCompleteWithFallback(
  opts: LLMCompletionOptions,
  models: string[]
): Promise<LLMCompletionResult> {
  let lastErr: unknown;
  const tried: string[] = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    tried.push(model);
    try {
      const result = await withRetry(
        () => nvidiaCompleteSingle(opts, model),
        `nvidia:${model}`,
        1 // only 1 retry per model — the fallback chain handles the rest
      );
      // Log fallback usage if not the first model.
      if (i > 0) {
        console.log(
          `[llm-provider] SMART_LLM fallback: "${model}" succeeded after ${i} previous model(s) failed.`
        );
      }
      return result;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[llm-provider] Model "${model}" failed: ${msg.slice(0, 120)}. → next model`
      );
      // No delay between models — we want speed. The fallback is instant.
    }
  }

  // All models failed.
  const triedStr = tried.join(", ");
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `All ${models.length} NVIDIA models failed. Tried: ${triedStr}. Last error: ${msg}`
  );
}

// Fast model: single model (no fallback needed — it's just for quick tasks).
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
  // The list of smart models in the fallback chain (for display).
  smartModels: string[];
}

export async function getLLM(): Promise<LLMProviderApi> {
  const provider = getLLMProvider();
  const smartModels = getSmartModels();

  if (provider === "nvidia") {
    return {
      provider: "nvidia",
      smartModels,
      fast: nvidiaFast,
      smart: (opts) => nvidiaCompleteWithFallback(opts, smartModels),
    };
  }

  // Z.AI backend (default, free).
  return {
    provider: "zai",
    smartModels: ["zai-built-in"],
    fast: zaiComplete,
    smart: zaiComplete,
  };
}
