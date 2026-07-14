// LLM provider abstraction — allows swapping between NVIDIA, OpenAI,
// Anthropic, and Ollama without changing research-engine code.
//
// Each provider implements this interface. The router (index.ts) selects
// the provider based on LLM_PROVIDER env var or auto-detects the first
// available one.

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
  provider: string;
  cost?: number; // USD for this call
}

export interface LLMProviderInterface {
  name: "nvidia" | "openai" | "anthropic" | "ollama";
  smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  models: string[];
  costPer1MTokens: { input: number; output: number }; // USD
  isAvailable(): boolean;
}
