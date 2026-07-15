// Tests for source quality scoring (Phase 12C).

import { describe, it, expect } from "vitest";
import {
  scoreSource,
  rankSources,
  rankSourcesWithMinimum,
} from "../source-quality";

describe("scoreSource", () => {
  it("scores .edu domains as tier1 (95+)", () => {
    const result = scoreSource("https://stanford.edu/research-paper");
    expect(result.tier).toBe("tier1");
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.reasons).toContain("trusted domain");
  });

  it("scores .gov domains as tier1", () => {
    const result = scoreSource("https://ncbi.nlm.nih.gov/article");
    expect(result.tier).toBe("tier1");
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it("scores wikipedia.org as tier1", () => {
    const result = scoreSource("https://en.wikipedia.org/wiki/RISC-V");
    expect(result.tier).toBe("tier1");
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it("scores nature.com as tier1", () => {
    const result = scoreSource("https://nature.com/articles/123");
    expect(result.tier).toBe("tier1");
  });

  it("scores github.com as tier2 (70+)", () => {
    const result = scoreSource("https://github.com/user/repo");
    expect(result.tier).toBe("tier2");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("scores stackoverflow.com as tier2", () => {
    const result = scoreSource("https://stackoverflow.com/questions/123");
    expect(result.tier).toBe("tier2");
  });

  it("scores developer.mozilla.org as tier2", () => {
    const result = scoreSource("https://developer.mozilla.org/en-US/docs/Web");
    expect(result.tier).toBe("tier2");
  });

  it("scores random blogs as tier3 (~50-60)", () => {
    const result = scoreSource("https://random-blog.com/post");
    expect(result.tier).toBe("tier3");
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(70);
  });

  it("adds HTTPS bonus (+5)", () => {
    const http = scoreSource("http://example.com");
    const https = scoreSource("https://example.com");
    expect(https.score).toBeGreaterThan(http.score);
  });

  it("adds substantial content bonus (+5)", () => {
    const short = scoreSource("https://example.com", "short");
    const long = scoreSource("https://example.com", "a".repeat(200));
    expect(long.score).toBeGreaterThan(short.score);
  });

  it("penalizes sponsored content (-20)", () => {
    const normal = scoreSource("https://example.com", "This is a great article about science.");
    const sponsored = scoreSource("https://example.com", "This is a sponsored advertisement about a product.");
    expect(sponsored.score).toBeLessThan(normal.score);
    expect(sponsored.reasons).toContain("sponsored content");
  });

  it("returns score 0 for invalid URLs", () => {
    const result = scoreSource("not a url");
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("invalid URL");
  });

  it("clamps score to 0-100", () => {
    // Even with all bonuses, should not exceed 100.
    const result = scoreSource("https://stanford.edu", "a".repeat(200));
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("rankSources", () => {
  it("sorts by score descending", () => {
    const sources = [
      { url: "https://random-blog.com/post", snippet: "blog post" },
      { url: "https://en.wikipedia.org/wiki/Test", snippet: "wiki article" },
      { url: "https://github.com/user/repo", snippet: "code repo" },
    ];

    const { ranked } = rankSources(sources);
    expect(ranked[0].url).toContain("wikipedia.org");
    expect(ranked[1].url).toContain("github.com");
    expect(ranked[2].url).toContain("random-blog.com");
  });

  it("drops sources with score < 30", () => {
    // A source that would score 0 (invalid URL) should be dropped.
    const sources = [
      { url: "https://en.wikipedia.org/wiki/Good", snippet: "good source" },
      { url: "not-a-url", snippet: "bad source" },
    ];

    const { ranked, dropped } = rankSources(sources);
    expect(ranked.length).toBe(1);
    expect(dropped.length).toBe(1);
    expect(dropped[0].url).toBe("not-a-url");
  });

  it("keeps all sources when all are high quality", () => {
    const sources = [
      { url: "https://en.wikipedia.org/wiki/A", snippet: "a".repeat(200) },
      { url: "https://stanford.edu/research", snippet: "b".repeat(200) },
    ];

    const { ranked, dropped } = rankSources(sources);
    expect(ranked.length).toBe(2);
    expect(dropped.length).toBe(0);
  });
});

describe("rankSourcesWithMinimum", () => {
  it("recovers dropped sources when below minimum", () => {
    const sources = [
      { url: "https://en.wikipedia.org/wiki/Good", snippet: "good" },
      { url: "not-a-url-1", snippet: "bad 1" },
      { url: "not-a-url-2", snippet: "bad 2" },
      { url: "not-a-url-3", snippet: "bad 3" },
    ];

    const { ranked } = rankSourcesWithMinimum(sources, 3);
    // Should have 3 results: 1 good + 2 recovered (to reach min 3).
    expect(ranked.length).toBe(3);
    // Wikipedia should be first (highest score).
    expect(ranked[0].url).toContain("wikipedia.org");
  });

  it("does not recover when minimum already met", () => {
    const sources = [
      { url: "https://en.wikipedia.org/wiki/A", snippet: "good a" },
      { url: "https://en.wikipedia.org/wiki/B", snippet: "good b" },
      { url: "https://en.wikipedia.org/wiki/C", snippet: "good c" },
      { url: "not-a-url", snippet: "bad" },
    ];

    const { ranked, dropped } = rankSourcesWithMinimum(sources, 3);
    expect(ranked.length).toBe(3);
    expect(dropped.length).toBe(1);
  });

  it("returns all when fewer than minimum available", () => {
    const sources = [
      { url: "https://en.wikipedia.org/wiki/A", snippet: "good a" },
    ];

    const { ranked, dropped } = rankSourcesWithMinimum(sources, 3);
    expect(ranked.length).toBe(1);
    expect(dropped.length).toBe(0);
  });
});
