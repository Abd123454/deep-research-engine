// Model router — intelligently chooses local vs cloud models based on task complexity.
// Local-first: simple tasks use Ollama (privacy + zero cost), complex tasks use cloud.

export interface ModelChoice {
  provider: "nvidia" | "openai" | "anthropic" | "ollama";
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
}

export function isLocalModelAvailable(): boolean {
  return !!process.env.OLLAMA_URL;
}

export function isAirGappedMode(): boolean {
  return process.env.AIR_GAPPED === "true";
}

export function isPrivacyMode(): boolean {
  return process.env.PRIVACY_MODE === "true";
}

export function chooseModel(
  task: "simple" | "complex" | "research" | "coding" | "vision",
  _options: { preferLocal?: boolean; maxCost?: number } = {}
): ModelChoice {
  // Air-gapped: Ollama only, always
  if (isAirGappedMode()) {
    return { provider: "ollama", model: "llama3.1:8b", reason: "Air-gapped mode — local only", estimatedCost: 0, estimatedLatencyMs: 500 };
  }

  // Privacy mode: Ollama only
  if (isPrivacyMode() && isLocalModelAvailable()) {
    return { provider: "ollama", model: "llama3.1:8b", reason: "Privacy mode — local only", estimatedCost: 0, estimatedLatencyMs: 500 };
  }

  // Simple tasks: prefer local if available
  if (task === "simple" && isLocalModelAvailable()) {
    return { provider: "ollama", model: "llama3.1:8b", reason: "Simple task — using local model for privacy + zero cost", estimatedCost: 0, estimatedLatencyMs: 500 };
  }

  // Research/complex: cloud (NVIDIA first, then OpenAI, then Anthropic)
  if (task === "research" || task === "complex") {
    if (process.env.NVIDIA_API_KEY) {
      return { provider: "nvidia", model: "meta/llama-3.1-70b-instruct", reason: "Complex task — using cloud model for strong reasoning", estimatedCost: 0.003, estimatedLatencyMs: 3000 };
    }
    if (process.env.OPENAI_API_KEY) {
      return { provider: "openai", model: "gpt-4o", reason: "Complex task — OpenAI fallback", estimatedCost: 0.01, estimatedLatencyMs: 2000 };
    }
  }

  // Coding: NVIDIA or OpenAI
  if (task === "coding") {
    if (process.env.NVIDIA_API_KEY) {
      return { provider: "nvidia", model: "meta/llama-3.1-70b-instruct", reason: "Coding task — using cloud model", estimatedCost: 0.003, estimatedLatencyMs: 3000 };
    }
  }

  // Vision: OpenAI or Anthropic
  if (task === "vision") {
    if (process.env.OPENAI_API_KEY) {
      return { provider: "openai", model: "gpt-4o", reason: "Vision task — OpenAI has multimodal", estimatedCost: 0.01, estimatedLatencyMs: 2000 };
    }
  }

  // Default: whatever is available
  if (process.env.NVIDIA_API_KEY) {
    return { provider: "nvidia", model: "meta/llama-3.1-8b-instruct", reason: "Default — NVIDIA available", estimatedCost: 0.001, estimatedLatencyMs: 1000 };
  }
  if (isLocalModelAvailable()) {
    return { provider: "ollama", model: "llama3.1:8b", reason: "Default — local model", estimatedCost: 0, estimatedLatencyMs: 500 };
  }

  throw new Error("No LLM provider available");
}
