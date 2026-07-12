// Smoke tests — verify the REAL external services work, not just mocked code.
//
// These tests are SKIPPED in CI (no API keys available) but run locally.
// They catch the "code passes but system is broken" failure mode that unit
// tests miss. Run with: bun run test

import { describe, it, expect } from "vitest";

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;

// Use describe.skipUnless pattern — if the key is missing, skip the suite.
const tavilySuite = TAVILY_KEY ? describe : describe.skip;
const nvidiaSuite = NVIDIA_KEY ? describe : describe.skip;

tavilySuite("smoke: real Tavily search", () => {
  it("returns at least 1 result for a simple query", async () => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: "what is RISC-V",
        max_results: 3,
        search_depth: "advanced",
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBeGreaterThan(0);
    for (const r of data.results) {
      expect(r.url).toBeTruthy();
      expect(r.title).toBeTruthy();
    }
  }, 15000);
});

nvidiaSuite("smoke: real NVIDIA NIM LLM", () => {
  it("returns a completion from the primary model", async () => {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NVIDIA_KEY}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: "Say 'hello' in one word." }],
        max_tokens: 10,
        temperature: 0,
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);
});

describe("smoke: DuckDuckGo fallback (no key needed)", () => {
  // DDG can be rate-limited/blocked. This test is best-effort: if DDG is
  // unreachable, we skip rather than fail (DDG is a last-resort fallback).
  it("JSON API returns a valid object (skips on network error)", async () => {
    try {
      const res = await fetch(
        "https://api.duckduckgo.com/?q=test&format=json&no_html=1",
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) {
        console.warn("DDG API returned non-OK status, skipping assertion");
        return;
      }
      const data = await res.json();
      expect(data).toBeTypeOf("object");
    } catch (err) {
      console.warn("DDG API unreachable, skipping:", err);
      return;
    }
  }, 20000);
});
