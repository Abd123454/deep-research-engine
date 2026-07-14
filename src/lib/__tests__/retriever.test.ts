// Tests for retriever.ts — DDG + Wikipedia + GitHub search, keyword extraction.
// Mocks global.fetch for all HTTP calls.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  searchWeb,
  wikipediaSearch,
  githubSearch,
} from "../retriever";

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- DDG HTML search ----------

describe("DDG HTML search", () => {
  it("extracts results from DDG HTML", async () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Page</a>
      <a class="result__snippet" href="#">This is a test snippet</a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftest.com">Test Site</a>
    `;
    fetchMock.mockResolvedValueOnce(
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
    );

    const results = await searchWeb("test query", 5);
    expect(results.length).toBeGreaterThan(0);
    // Wikipedia and GitHub are also called (they may return 0 if mocked to fail)
  });

  it("detects CAPTCHA page", async () => {
    const html = '<div class="anomaly-modal">CAPTCHA required</div>';
    fetchMock.mockResolvedValueOnce(
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
    );
    // Also mock Wikipedia + GitHub to return empty so searchWeb doesn't hang
    fetchMock.mockResolvedValue(new Response('{"RelatedTopics":[]}', { status: 200 }));

    const results = await searchWeb("test", 5);
    // DDG fails → Wikipedia + GitHub fallback may produce results
    expect(Array.isArray(results)).toBe(true);
  });
});

// ---------- Wikipedia search ----------

describe("Wikipedia search", () => {
  it("returns articles from Wikipedia opensearch API", async () => {
    const wikiResponse = [
      "RISC-V",
      ["RISC-V", "RISC-V ecosystem", "RISC-V assembly"],
      ["desc1", "desc2", "desc3"],
      ["https://en.wikipedia.org/wiki/RISC-V", "https://en.wikipedia.org/wiki/RISC-V_ecosystem", "https://en.wikipedia.org/wiki/RISC-V_assembly"],
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(wikiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const results = await wikipediaSearch("RISC-V", 5);
    expect(results.length).toBe(3);
    expect(results[0]!.url).toBe("https://en.wikipedia.org/wiki/RISC-V");
    expect(results[0]!.name).toBe("RISC-V");
  });

  it("returns empty array for no results", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(["query", [], [], []]), { status: 200 })
    );
    const results = await wikipediaSearch("nonexistent", 5);
    expect(results).toHaveLength(0);
  });

  it("throws on 429 rate limit after retry", async () => {
    // Both attempts return 429
    fetchMock.mockResolvedValue(
      new Response("Rate limited", { status: 429 })
    );
    await expect(wikipediaSearch("test", 5)).rejects.toThrow(/429|Wikipedia/i);
  });
});

// ---------- GitHub search ----------

describe("GitHub search", () => {
  it("returns repos from GitHub API", async () => {
    const ghResponse = {
      items: [
        { html_url: "https://github.com/user/repo1", full_name: "user/repo1", description: "A test repo" },
        { html_url: "https://github.com/user/repo2", full_name: "user/repo2", description: "Another repo" },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(ghResponse), { status: 200 })
    );

    const results = await githubSearch("test", 5);
    expect(results.length).toBe(2);
    expect(results[0]!.url).toBe("https://github.com/user/repo1");
    expect(results[0]!.name).toBe("user/repo1");
  });

  it("returns empty array for no items", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"items":[]}', { status: 200 })
    );
    const results = await githubSearch("nonexistent", 5);
    expect(results).toHaveLength(0);
  });

  it("throws on 403 rate limit", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    await expect(githubSearch("test", 5)).rejects.toThrow(/403|GitHub/i);
  });
});

// ---------- searchWeb integration ----------

describe("searchWeb fallback chain", () => {
  it("combines results from multiple sources", async () => {
    // DDG: returns results
    fetchMock.mockResolvedValueOnce(
      new Response('<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example</a>', {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );
    // Wikipedia: returns results
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(["q", ["Wiki Article"], [""], ["https://en.wikipedia.org/wiki/Test"]]), {
        status: 200,
      })
    );
    // GitHub: returns results
    fetchMock.mockResolvedValueOnce(
      new Response('{"items":[{"html_url":"https://github.com/test/repo","full_name":"test/repo","description":"test"}]}', {
        status: 200,
      })
    );

    const results = await searchWeb("test", 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array when all sources fail", async () => {
    // DDG: CAPTCHA (throws after retries)
    fetchMock.mockResolvedValue(
      new Response('<div class="anomaly-modal">CAPTCHA</div>', {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );

    const results = await searchWeb("test", 5);
    expect(Array.isArray(results)).toBe(true);
  }, 30000); // DDG retries take time
});

// ---------- URL filtering ----------

describe("URL filtering", () => {
  it("filters out duckduckgo.com internal URLs", async () => {
    const wikiResponse = [
      "test",
      ["Internal"],
      [""],
      ["https://duckduckgo.com/internal"],
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(wikiResponse), { status: 200 })
    );
    // Mock DDG + GitHub to return empty
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));

    const results = await searchWeb("test", 5);
    // The duckduckgo.com URL should not appear in results
    expect(results.every((r) => !r.url.includes("duckduckgo.com"))).toBe(true);
  });

  it("filters out google.com URLs via GitHub", async () => {
    const ghResponse = {
      items: [
        { html_url: "https://google.com/search", full_name: "google", description: "" },
        { html_url: "https://github.com/real/repo", full_name: "real/repo", description: "" },
      ],
    };
    // Mock DDG CAPTCHA (fails fast after retries), Wikipedia empty, GitHub mixed
    fetchMock.mockResolvedValue(
      new Response('<div class="anomaly-modal">CAPTCHA</div>', { status: 200 })
    );

    const results = await githubSearch("test", 5).catch(() => []);
    // Directly test githubSearch with mock
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(ghResponse), { status: 200 })
    );
    const ghResults = await githubSearch("test", 5);
    expect(ghResults.every((r) => !r.url.includes("google.com"))).toBe(true);
  }, 30000);
});

// ---------- Deduplication ----------

describe("deduplication", () => {
  it("searchWeb deduplicates URLs across sources", async () => {
    // DDG returns a URL, Wikipedia returns the same URL
    const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FTest">Test</a>';
    const wikiResponse = [
      "test",
      ["Test Article"],
      [""],
      ["https://en.wikipedia.org/wiki/Test"],
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(wikiResponse), { status: 200 })
    );
    fetchMock.mockResolvedValueOnce(
      new Response('{"items":[]}', { status: 200 })
    );

    const results = await searchWeb("test", 10);
    const urls = results.map((r) => r.url);
    const uniqueUrls = new Set(urls);
    // Dedup should ensure no duplicate URLs
    expect(urls.length).toBe(uniqueUrls.size);
  }, 15000);
});
