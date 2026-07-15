// Stability layer — retry, circuit breaker, fallback, health checks.
//
// Provides resilience patterns for production use:
// - withRetry: exponential backoff for transient failures.
// - CircuitBreaker: stops calling a failing service after N failures.
// - withFallback: tries multiple operations, returns first success.
// - systemHealth: checks all subsystems.

import { getDb } from "./db";
import { getRedis } from "./redis";

// ---------- Retry with backoff ----------

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    backoff?: "linear" | "exponential";
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { retries = 3, backoff = "exponential", initialDelay = 1000, maxDelay = 10000, onRetry } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === retries) break;

      // Don't retry on auth errors.
      const msg = lastError.message.toLowerCase();
      if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("invalid") && msg.includes("key")) break;

      const delay = backoff === "exponential"
        ? Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
        : initialDelay * (attempt + 1);

      onRetry?.(attempt + 1, lastError);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

// ---------- Circuit Breaker ----------

export class CircuitBreaker {
  private failures = new Map<string, { count: number; lastFailure: number }>();
  private threshold: number;
  private resetTime: number;

  constructor(threshold = 5, resetTime = 60_000) {
    this.threshold = threshold;
    this.resetTime = resetTime;
  }

  isOpen(key: string): boolean {
    const state = this.failures.get(key);
    if (!state) return false;
    if (Date.now() - state.lastFailure > this.resetTime) {
      this.failures.delete(key);
      return false;
    }
    return state.count >= this.threshold;
  }

  recordFailure(key: string): void {
    const state = this.failures.get(key) || { count: 0, lastFailure: 0 };
    state.count++;
    state.lastFailure = Date.now();
    this.failures.set(key, state);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }
}

// ---------- Fallback ----------

export async function withFallback<T>(
  operations: Array<() => Promise<T>>,
  defaultResult?: T
): Promise<T> {
  for (const op of operations) {
    try {
      return await op();
    } catch {
      continue;
    }
  }
  if (defaultResult !== undefined) return defaultResult;
  throw new Error("All operations failed");
}

// ---------- System Health ----------

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, boolean>;
  details?: Record<string, string>;
}

export async function systemHealth(): Promise<HealthStatus> {
  const checks: Record<string, boolean> = {};
  const details: Record<string, string> = {};

  // Check LLM provider availability.
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOllama = !!process.env.OLLAMA_URL;
  checks.llm = hasNvidia || hasOpenai || hasAnthropic || hasOllama;
  details.llm = [
    hasNvidia && "nvidia",
    hasOpenai && "openai",
    hasAnthropic && "anthropic",
    hasOllama && "ollama",
  ].filter(Boolean).join(", ") || "none";

  // Check database.
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    checks.database = true;
    details.database = "sqlite";
  } catch {
    checks.database = false;
    details.database = "failed";
  }

  // Check Redis.
  try {
    const redis = getRedis();
    if (redis) {
      const pong = await redis.ping();
      checks.redis = pong === "PONG";
      details.redis = "connected";
    } else {
      checks.redis = false;
      details.redis = "not_configured";
    }
  } catch {
    checks.redis = false;
    details.redis = "failed";
  }

  // Check Docker (for sandbox).
  try {
    const { execSync } = await import("child_process");
    execSync("docker info", { timeout: 3000, stdio: "ignore" });
    checks.docker = true;
    details.docker = "available";
  } catch {
    checks.docker = false;
    details.docker = "not_available (using vm fallback)";
  }

  const allHealthy = Object.values(checks).every((v) => v);
  const someHealthy = Object.values(checks).some((v) => v);

  return {
    status: allHealthy ? "healthy" : someHealthy ? "degraded" : "unhealthy",
    checks,
    details,
  };
}
