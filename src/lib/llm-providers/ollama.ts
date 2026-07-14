// Ollama provider — local, free, open-source models.
// Runs on localhost:11434. No API key needed.
// Models: llama3.1:70b, llama3.1:8b, qwen2.5:7b, etc.

import type {
  LLMProviderInterface,
  LLMCompletionOptions,
  LLMCompletionResult,
} from "./types";
import { env, envList } from "../env";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OllamaProvider implements LLMProviderInterface {
  name = "ollama" as const;
  models: string[];
  costPer1MTokens = { input: 0, output: 0 }; // local = free

  constructor() {
    this.models = envList("OLLAMA_MODELS", "llama3.1:70b,llama3.1:8b,qwen2.5:7b");
  }

  isAvailable(): boolean {
    // Check if Ollama URL is configured. Actual health check is async
    // (not suitable for the sync isAvailable interface), so we just
    // check the env var. The router does a real health check.
    return !!env("OLLAMA_URL", "");
  }

  private get baseUrl(): string {
    return env("OLLAMA_URL", "http://localhost:11434");
  }

  // Async health check — used by the router to detect if Ollama is running.
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async completeSingle(
    opts: LLMCompletionOptions,
    model: string
  ): Promise<LLMCompletionResult> {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      stream: opts.stream ?? false,
      options: {
        temperature: opts.temperature ?? 0.4,
        num_predict: opts.maxTokens ?? 2048,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // 2 min timeout for local models
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error (${res.status}): ${text.slice(0, 300)}`);
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
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            const token = chunk.message?.content;
            if (token) { fullContent += token; opts.onToken?.(token); }
          } catch { /* skip */ }
        }
      }
      const tokens = Math.ceil(fullContent.length / 4);
      return { content: fullContent, tokensUsed: tokens, model, provider: "ollama", cost: 0 };
    }

    // Non-streaming: Ollama returns NDJSON (one JSON object per line).
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    let content = "";
    let evalCount = 0;
    for (const line of lines) {
      try {
        const data = JSON.parse(line) as { message?: { content?: string }; eval_count?: number; done?: boolean };
        if (data.message?.content) content += data.message.content;
        if (data.eval_count) evalCount = data.eval_count;
      } catch { /* skip */ }
    }
    return { content, tokensUsed: evalCount || Math.ceil(content.length / 4), model, provider: "ollama", cost: 0 };
  }

  async smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        return await this.completeSingle(opts, model);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ollama] Model "${model}" failed: ${msg.slice(0, 100)}`);
      }
    }
    throw new Error(`All Ollama models failed. Last: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  }

  async fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const fastModel = env("OLLAMA_FAST_MODEL", this.models[this.models.length - 1] || "llama3.1:8b");
    return this.completeSingle(opts, fastModel);
  }
}
