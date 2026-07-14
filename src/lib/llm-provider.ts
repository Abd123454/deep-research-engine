// LLM provider — Ollama (local, open-source, free).
// No API keys. No cloud. Runs on localhost:11434.
//
// Install Ollama: https://ollama.com
// Pull models:
//   ollama pull llama3.1:8b       (fast, for sub-questions)
//   ollama pull llama3.1:70b      (smart, for reports) — needs 40GB RAM
//   or use smaller models:
//   ollama pull qwen2.5:7b
//   ollama pull mistral:7b

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: "ollama";
}

function env(key: string, fallback = ""): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim();
}

const OLLAMA_URL = env("OLLAMA_URL", "http://localhost:11434");

export function getSmartModel(): string {
  return env("SMART_LLM", "llama3.1:70b");
}

export function getFastModel(): string {
  return env("FAST_LLM", "llama3.1:8b");
}

export function getSmartModels(): string[] {
  return [getSmartModel()];
}

export function getLLMProvider(): "ollama" {
  return "ollama";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ollamaComplete(
  opts: LLMCompletionOptions,
  model: string
): Promise<LLMCompletionResult> {
  const url = `${OLLAMA_URL}/api/chat`;

  // Ollama uses a different API format than OpenAI.
  // POST /api/chat with messages array.
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: opts.stream ?? false,
    options: {
      temperature: opts.temperature ?? 0.4,
      num_predict: opts.maxTokens ?? 2048,
    },
  };

  if (opts.stream && opts.onToken) {
    // Streaming: read NDJSON line by line.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    let fullContent = "";
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as {
              message?: { content?: string };
              done?: boolean;
            };
            const token = chunk.message?.content;
            if (token) {
              fullContent += token;
              opts.onToken(token);
            }
          } catch { /* skip */ }
        }
      }
    }

    return {
      content: fullContent,
      model,
      provider: "ollama",
    };
  }

  // Non-streaming.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    eval_count?: number;
  };

  return {
    content: data.message?.content ?? "",
    tokensUsed: data.eval_count,
    model,
    provider: "ollama",
  };
}

// Fallback chain: try smart model, then fast model.
async function smartComplete(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  let lastErr: unknown;
  const models = [getSmartModel(), getFastModel()];

  for (const model of models) {
    try {
      return await ollamaComplete(opts, model);
    } catch (err) {
      lastErr = err;
      console.warn(`[llm] ${model} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
  throw lastErr;
}

async function fastComplete(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  return ollamaComplete(opts, getFastModel());
}

export interface LLMProviderApi {
  fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  provider: "ollama";
  smartModels: string[];
}

export async function getLLM(): Promise<LLMProviderApi> {
  return {
    provider: "ollama",
    smartModels: [getSmartModel()],
    fast: fastComplete,
    smart: smartComplete,
  };
}
