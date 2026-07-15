// LLM provider abstraction — allows swapping between NVIDIA, OpenAI,
// Anthropic, and Ollama without changing research-engine code.
//
// Each provider implements this interface. The router (index.ts) selects
// the provider based on LLM_PROVIDER env var or auto-detects the first
// available one.

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  stream?: boolean;
  onToken?: (token: string) => void;
  tools?: LLMTool[];
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: string;
  cost?: number;
  toolCalls?: LLMToolCall[];
}

export interface LLMProviderInterface {
  name: "nvidia" | "openai" | "anthropic" | "ollama";
  smart(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  fast(opts: LLMCompletionOptions): Promise<LLMCompletionResult>;
  models: string[];
  costPer1MTokens: { input: number; output: number };
  isAvailable(): boolean;
}
