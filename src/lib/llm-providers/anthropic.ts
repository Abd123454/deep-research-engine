// Anthropic provider — Claude 3.5 Sonnet, Claude 3.5 Haiku.
// Cost: $3/1M input, $15/1M output (sonnet).
// Streaming support via SSE.

import type {
  LLMProviderInterface,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMMessage,
} from "./types";
import { env, envList } from "../env";
import { logger } from "../logger";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("429") || m.includes("529") || m.includes("overloaded") || m.includes("timeout");
}

function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("403") || m.includes("authentication_error");
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

export class AnthropicProvider implements LLMProviderInterface {
  name = "anthropic" as const;
  models: string[];
  costPer1MTokens = { input: 3, output: 15 }; // sonnet pricing

  constructor() {
    this.models = envList("ANTHROPIC_MODELS", "claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022");
  }

  isAvailable(): boolean {
    return !!env("ANTHROPIC_API_KEY");
  }

  private get baseUrl(): string {
    return env("ANTHROPIC_BASE_URL", "https://api.anthropic.com");
  }

  // Anthropic API uses a different message format: system prompt is separate.
  private convertMessages(messages: LLMMessage[]): { system: string; messages: { role: string; content: string }[] } {
    const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return { system: systemParts.join("\n\n"), messages: userMessages };
  }

  private async completeSingle(
    opts: LLMCompletionOptions,
    model: string
  ): Promise<LLMCompletionResult> {
    const apiKey = env("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

    const { system, messages } = this.convertMessages(opts.messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
      system,
      messages,
    };
    if (opts.json) {
      body.messages = [...messages, { role: "user", content: "Respond with valid JSON only." }];
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        Accept: opts.stream ? "text/event-stream" : "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${text.slice(0, 300)}`);
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
          try {
            const chunk = JSON.parse(trimmed.slice(6)) as {
              type?: string;
              delta?: { text?: string };
            };
            if (chunk.type === "content_block_delta" && chunk.delta?.text) {
              fullContent += chunk.delta.text;
              opts.onToken?.(chunk.delta.text);
            }
          } catch { /* skip */ }
        }
      }
      const tokens = Math.ceil(fullContent.length / 4);
      const cost = (tokens / 1_000_000) * this.costPer1MTokens.output;
      return { content: fullContent, tokensUsed: tokens, model, provider: "anthropic", cost };
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = data.content?.[0]?.text ?? "";
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? Math.ceil(content.length / 4);
    const tokensUsed = outputTokens;
    const cost =
      (inputTokens / 1_000_000) * this.costPer1MTokens.input +
      (outputTokens / 1_000_000) * this.costPer1MTokens.output;
    return { content, tokensUsed, model, provider: "anthropic", cost };
  }

  async smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        return await withRetry(() => this.completeSingle(opts, model), 1);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg)) throw new Error(`Anthropic API key invalid. Skipping fallback. Error: ${msg}`);
        logger.warn(
          { module: "anthropic", model, err: msg.slice(0, 100) },
          "Model failed"
        );
      }
    }
    throw new Error(`All Anthropic models failed. Last: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  }

  async fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const fastModel = env("ANTHROPIC_FAST_MODEL", this.models[this.models.length - 1] || "claude-3-5-haiku-20241022");
    return withRetry(() => this.completeSingle(opts, fastModel), 3);
  }
}
