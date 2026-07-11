// LLM Provider abstraction.
//
// Supports two backends:
//   1. "zai"     -> built-in z-ai-web-dev-sdk (FREE, no key needed in this env)
//   2. "nvidia"  -> NVIDIA NIM (OpenAI-compatible endpoint)
//
// Configuration is read from environment variables (see .env).

import ZAI from "z-ai-web-dev-sdk";
import type { LLMProvider } from "./types";

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

function env(key: string, fallback = ""): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim();
}

export function getLLMProvider(): LLMProvider {
  const v = env("LLM_PROVIDER", "zai").toLowerCase();
  // Auto-fallback to zai if NVIDIA selected but no key configured.
  if (v === "nvidia" && !env("NVIDIA_API_KEY")) {
    return "zai";
  }
  return v === "nvidia" ? "nvidia" : "zai";
}

export function getSmartModel(): string {
  return env("SMART_LLM", "nvidia/llama-3.1-nemotron-70b-instruct");
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

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 4
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < retries && isRetryableLLMError(msg)) {
        // Exponential backoff: 3s, 6s, 12s, 24s
        const delayMs = 3000 * Math.pow(2, attempt);
        await sleep(delayMs);
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

// ---------- NVIDIA NIM backend (OpenAI-compatible) ----------

async function nvidiaComplete(
  opts: LLMCompletionOptions,
  model: string
): Promise<LLMCompletionResult> {
  return withRetry(async () => {
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
          500
        )}`
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return {
      content,
      tokensUsed: data.usage?.total_tokens,
      model,
      provider: "nvidia" as const,
    };
  }, "nvidiaComplete");
}

// ---------- Public API ----------

export interface LLMProviderApi {
  fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  provider: LLMProvider;
}

export async function getLLM(): Promise<LLMProviderApi> {
  const provider = getLLMProvider();
  const fastModel = getFastModel();
  const smartModel = getSmartModel();

  if (provider === "nvidia") {
    return {
      provider: "nvidia",
      fast: (opts) => nvidiaComplete(opts, fastModel),
      smart: (opts) => nvidiaComplete(opts, smartModel),
    };
  }

  // Z.AI backend (default, free).
  return {
    provider: "zai",
    fast: zaiComplete,
    smart: zaiComplete,
  };
}
