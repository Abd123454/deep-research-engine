// LLM provider router — selects the right provider and handles cross-provider
// fallback (e.g. NVIDIA down → OpenAI → Anthropic → Ollama).
//
// Provider selection:
//   1. LLM_PROVIDER env var explicitly sets the provider ("nvidia" | "openai" | "anthropic" | "ollama" | "auto")
//   2. "auto" (default) tries providers in order: NVIDIA → OpenAI → Anthropic → Ollama
//   3. Only providers with valid API keys (or running server for Ollama) are tried

import { env } from "../env";
import type {
  LLMProviderInterface,
  LLMCompletionOptions,
  LLMCompletionResult,
} from "./types";
import { getLLM as getNvidiaLLM } from "../llm-provider";
import { logger } from "../logger";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";

// ---------- NVIDIA adapter ----------
// The existing llm-provider.ts already has getLLM() which returns
// { provider, smartModels, smart, fast }. We wrap it to implement
// LLMProviderInterface.
class NvidiaProviderAdapter implements LLMProviderInterface {
  name = "nvidia" as const;
  models: string[] = [];
  costPer1MTokens = { input: 0, output: 0 }; // NVIDIA free tier

  constructor() {
    // Import lazily to avoid circular deps at module load time.
    import("../llm-provider").then(({ getSmartModels }) => {
      this.models = getSmartModels();
    });
  }

  isAvailable(): boolean {
    return !!env("NVIDIA_API_KEY");
  }

  async smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const llm = await getNvidiaLLM();
    const result = await llm.smart(opts);
    return { ...result, provider: "nvidia", cost: 0 };
  }

  async fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const llm = await getNvidiaLLM();
    const result = await llm.fast(opts);
    return { ...result, provider: "nvidia", cost: 0 };
  }
}

// ---------- Provider registry ----------
const providers: Record<string, LLMProviderInterface> = {};

function getProviderInstance(name: string): LLMProviderInterface | null {
  if (providers[name]) return providers[name];
  switch (name) {
    case "nvidia":
      providers.nvidia = new NvidiaProviderAdapter();
      return providers.nvidia;
    case "openai":
      providers.openai = new OpenAIProvider();
      return providers.openai;
    case "anthropic":
      providers.anthropic = new AnthropicProvider();
      return providers.anthropic;
    case "ollama":
      providers.ollama = new OllamaProvider();
      return providers.ollama;
    default:
      return null;
  }
}

// ---------- Public API ----------

export function getProvider(name?: string): LLMProviderInterface {
  const requested = name || env("LLM_PROVIDER", "nvidia");
  const p = getProviderInstance(requested);
  if (p) return p;
  // Fallback to NVIDIA if unknown provider.
  return getProviderInstance("nvidia")!;
}

/**
 * Get the ordered list of available providers for auto/fallback mode.
 * Only providers with valid API keys (or running server for Ollama) are included.
 */
export function getAvailableProviders(): string[] {
  const chain: string[] = [];
  if (env("NVIDIA_API_KEY")) chain.push("nvidia");
  if (env("OPENAI_API_KEY")) chain.push("openai");
  if (env("ANTHROPIC_API_KEY")) chain.push("anthropic");
  if (env("OLLAMA_URL")) chain.push("ollama");
  return chain;
}

/**
 * Smart completion with cross-provider fallback.
 * If LLM_PROVIDER is explicitly set (not "auto"), uses only that provider.
 * If "auto" or unset, tries providers in order: NVIDIA → OpenAI → Anthropic → Ollama.
 */
export async function smartWithFallback(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  const requested = env("LLM_PROVIDER", "auto");

  // Explicit provider — no cross-provider fallback.
  if (requested !== "auto") {
    const provider = getProvider(requested);
    return provider.smart(opts);
  }

  // Auto mode — try each available provider in order.
  const chain = getAvailableProviders();
  if (chain.length === 0) {
    throw new Error(
      "No LLM provider available. Set at least one of: NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_URL."
    );
  }

  let lastErr: unknown;
  for (const name of chain) {
    const provider = getProvider(name);
    try {
      return await provider.smart(opts);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { module: "llm-router", provider: name, err: msg.slice(0, 100) },
        "Provider failed -> next provider"
      );
    }
  }

  throw new Error(
    `All LLM providers failed (${chain.join(", ")}). Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  );
}

/**
 * Fast completion with cross-provider fallback (same logic as smart).
 */
export async function fastWithFallback(
  opts: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  const requested = env("LLM_PROVIDER", "auto");

  if (requested !== "auto") {
    const provider = getProvider(requested);
    return provider.fast(opts);
  }

  const chain = getAvailableProviders();
  if (chain.length === 0) {
    throw new Error("No LLM provider available.");
  }

  let lastErr: unknown;
  for (const name of chain) {
    const provider = getProvider(name);
    try {
      return await provider.fast(opts);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { module: "llm-router", provider: name, path: "fast", err: msg.slice(0, 100) },
        "Provider fast failed -> next provider"
      );
    }
  }

  throw new Error(
    `All LLM providers failed (${chain.join(", ")}). Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  );
}

// Re-export types for convenience.
export type { LLMProviderInterface, LLMCompletionOptions, LLMCompletionResult, LLMMessage } from "./types";
