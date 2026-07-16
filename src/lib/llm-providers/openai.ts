// OpenAI provider — GPT-4o, GPT-4o-mini.
// Cost: $2.50/1M input, $10/1M output (gpt-4o).
// Streaming support via SSE (same format as NVIDIA — OpenAI-compatible).
import * as Sentry from "@sentry/nextjs";


import type {
  LLMProviderInterface,
  LLMCompletionOptions,
  LLMCompletionResult,
} from "./types";
import { env, envList } from "../env";
import { logger } from "../logger";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("429") || m.includes("rate limit") || m.includes("503") || m.includes("timeout");
}

function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("403") || m.includes("unauthorized") || m.includes("invalid api key");
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i < retries && isRetryable(msg)) { await sleep(1000); continue; }
      break;
    }
  }
  throw lastErr;
}

export class OpenAIProvider implements LLMProviderInterface {
  name = "openai" as const;
  models: string[];
  costPer1MTokens = { input: 2.5, output: 10 }; // gpt-4o pricing

  constructor() {
    this.models = envList("OPENAI_MODELS", "gpt-4o,gpt-4o-mini");
  }

  isAvailable(): boolean {
    return !!env("OPENAI_API_KEY");
  }

  private get baseUrl(): string {
    return env("OPENAI_BASE_URL", "https://api.openai.com/v1");
  }

  private async completeSingle(
    opts: LLMCompletionOptions,
    model: string
  ): Promise<LLMCompletionResult> {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 2048,
      stream: opts.stream ?? false,
    };
    if (opts.json) body.response_format = { type: "json_object" };

    // Native tool calling support (OpenAI function calling format).
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
      throw new Error(`OpenAI error (${res.status}): ${text.slice(0, 300)}`);
    }

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
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) { fullContent += token; opts.onToken?.(token); }
          } catch (err) {
  Sentry.captureException(err);
/* skip */ 
}
        }
      }
      const tokens = Math.ceil(fullContent.length / 4);
      const cost = (tokens / 1_000_000) * this.costPer1MTokens.output;
      return { content: fullContent, tokensUsed: tokens, model, provider: "openai", cost };
    }

    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }[];
      usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const tokensUsed = data.usage?.completion_tokens ?? data.usage?.total_tokens;
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? tokensUsed ?? 0;
    const cost =
      (inputTokens / 1_000_000) * this.costPer1MTokens.input +
      (outputTokens / 1_000_000) * this.costPer1MTokens.output;

    // Parse native tool calls from OpenAI response.
    const rawToolCalls = data.choices?.[0]?.message?.tool_calls;
    const toolCalls = rawToolCalls?.map((tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch (err) {
  Sentry.captureException(err);
/* leave empty */ 
}
      return { id: tc.id, name: tc.function.name, arguments: args };
    });

    return { content, tokensUsed, model, provider: "openai", cost, toolCalls };
  }

  async smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        return await withRetry(() => this.completeSingle(opts, model), 1);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg)) throw new Error(`OpenAI API key invalid. Skipping fallback. Error: ${msg}`);
        logger.warn(
          { module: "openai", model, err: msg.slice(0, 100) },
          "Model failed"
        );
      }
    }
    throw new Error(`All OpenAI models failed. Last: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  }

  async fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const fastModel = env("OPENAI_FAST_MODEL", this.models[this.models.length - 1] || "gpt-4o-mini");
    return withRetry(() => this.completeSingle(opts, fastModel), 3);
  }
}
