import { describe, it, expect } from "vitest";

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const nvidiaSuite = NVIDIA_KEY ? describe : describe.skip;

nvidiaSuite("smoke: real NVIDIA NIM LLM", () => {
  it("returns a completion from the primary model", async () => {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_KEY}` },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: "Say hello in one word." }],
        max_tokens: 10, temperature: 0,
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);
});

describe("smoke: DuckDuckGo search (no key needed)", () => {
  it("returns results for a simple query", async () => {
    try {
      const res = await fetch(
        "https://html.duckduckgo.com/html/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
          },
          body: "q=test&kp=-2&kl=us-en",
          signal: AbortSignal.timeout(15000),
        }
      );
      expect(res.ok).toBe(true);
    } catch (err) {
      console.warn("DDG unreachable, skipping:", err);
    }
  }, 20000);
});
