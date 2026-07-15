// Tests for stability.ts — retry, circuit breaker, fallback, health.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules.
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({ get: vi.fn(() => ({ "1": 1 })) })),
  })),
}));

vi.mock("../redis", () => ({
  getRedis: vi.fn(() => null),
}));

vi.mock("../llm-provider", () => ({
  getLLM: vi.fn(async () => ({ provider: "nvidia" })),
}));

import { withRetry, CircuitBreaker, withFallback, systemHealth } from "../stability";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withRetry", () => {
  it("succeeds on first try", async () => {
    const fn = vi.fn(async () => "success");
    const result = await withRetry(fn, { retries: 2 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockResolvedValueOnce("success");
    const result = await withRetry(fn, { retries: 2, initialDelay: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { retries: 2, initialDelay: 10 })).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on auth errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("401 Unauthorized"));
    await expect(withRetry(fn, { retries: 3 })).rejects.toThrow("401");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    await withRetry(fn, { retries: 2, initialDelay: 10, onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen("test")).toBe(false);
  });

  it("opens after threshold failures", () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure("svc");
    cb.recordFailure("svc");
    expect(cb.isOpen("svc")).toBe(false);
    cb.recordFailure("svc");
    expect(cb.isOpen("svc")).toBe(true);
  });

  it("resets after reset time", () => {
    const cb = new CircuitBreaker(1, 100); // 100ms reset
    cb.recordFailure("svc");
    expect(cb.isOpen("svc")).toBe(true);
    // Wait for reset.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.isOpen("svc")).toBe(false);
        resolve();
      }, 150);
    });
  });

  it("recordSuccess clears failures", () => {
    const cb = new CircuitBreaker(2);
    cb.recordFailure("svc");
    cb.recordFailure("svc");
    expect(cb.isOpen("svc")).toBe(true);
    cb.recordSuccess("svc");
    expect(cb.isOpen("svc")).toBe(false);
  });
});

describe("withFallback", () => {
  it("returns first success", async () => {
    const result = await withFallback([
      async () => "first",
      async () => "second",
    ]);
    expect(result).toBe("first");
  });

  it("falls through to second on failure", async () => {
    const result = await withFallback([
      async () => { throw new Error("fail"); },
      async () => "second",
    ]);
    expect(result).toBe("second");
  });

  it("returns default when all fail", async () => {
    const result = await withFallback([
      async () => { throw new Error("1"); },
      async () => { throw new Error("2"); },
    ], "default");
    expect(result).toBe("default");
  });

  it("throws when all fail and no default", async () => {
    await expect(withFallback([
      async () => { throw new Error("1"); },
    ])).rejects.toThrow("All operations failed");
  });
});

describe("systemHealth", () => {
  it("returns health status", async () => {
    process.env.NVIDIA_API_KEY = "test";
    const health = await systemHealth();
    expect(health.status).toBeDefined();
    expect(health.checks).toBeDefined();
    expect(health.checks.llm).toBe(true);
    expect(health.checks.database).toBe(true);
  });

  it("reports degraded when Redis not configured", async () => {
    process.env.NVIDIA_API_KEY = "test";
    const health = await systemHealth();
    expect(health.checks.redis).toBe(false);
    expect(health.details?.redis).toContain("not_configured");
  });

  it("reports Docker status", async () => {
    const health = await systemHealth();
    expect(health.checks.docker).toBeDefined();
  });
});
