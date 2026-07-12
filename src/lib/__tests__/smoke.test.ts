// Smoke tests — verify the REAL external services work, not just mocked code.
//
// These tests are SKIPPED in CI (no API keys available) but run locally.
// They catch the "code passes but system is broken" failure mode that unit
// tests miss. Run with: bun run test
//
// If TAVILY_API_KEY or NVIDIA_API_KEY is unset, the test is skipped (not failed).

import { describe, it, expect } from "vitest";

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;

describe("smoke: real Tavily search", { skip: !TAVILY_KEY ? "TAVILY_API_KEY not set" : undefined }, () => {
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
    // Each result should have a URL and title.
    for (const r of data.results) {
      expect(r.url).toBeTruthy();
      expect(r.title).toBeTruthy();
    }
  }, 15000); // 15s timeout for network call
});

describe("smoke: real NVIDIA NIM LLM", { skip: !NVIDIA_KEY ? "NVIDIA_API_KEY not set" : undefined }, () => {
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
  }, 30000); // 30s timeout for LLM call
});

describe("smoke: DuckDuckGo fallback (no key needed)", () => {
  it("HTML scraping OR JSON API returns something", async () => {
    // Try the JSON API (HTML scraping may be CAPTCHA'd).
    const res = await fetch(
      "https://api.duckduckgo.com/?q=test&format=json&no_html=1",
      { signal: AbortSignal.timeout(10000) }
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    // DDG JSON API always returns a valid JSON object, even if empty.
    expect(data).toBeTypeOf("object");
  }, 15000);
});
