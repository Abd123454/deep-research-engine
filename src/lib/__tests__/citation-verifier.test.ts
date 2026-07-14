// Tests for citation-verifier.ts — extraction + verification logic.

import { describe, it, expect } from "vitest";
import {
  extractCitations,
  verifyCitation,
  verifyAllCitations,
  type Source,
} from "../citation-verifier";

const mockSources: Source[] = [
  {
    url: "https://en.wikipedia.org/wiki/RISC-V",
    title: "RISC-V — Wikipedia",
    excerpt: "RISC-V is a free and open standard instruction set architecture based on reduced instruction set computer principles.",
    text: "RISC-V is a free and open standard instruction set architecture based on reduced instruction set computer principles. It was developed at UC Berkeley in 2010. The base instruction set is RV32I or RV64I.",
  },
  {
    url: "https://github.com/riscv/riscv-isa-manual",
    title: "RISC-V ISA Manual",
    excerpt: "The RISC-V Instruction Set Manual repository.",
    text: "This repository contains the source files for the RISC-V Instruction Set Manual. RISC-V is an open standard ISA.",
  },
  {
    url: "https://example.com/empty",
    title: "Empty Source",
    excerpt: "",
    text: "",
  },
];

// ---------- extractCitations ----------

describe("extractCitations", () => {
  it("extracts inline links [text](url)", () => {
    const report = "RISC-V is open [source](https://en.wikipedia.org/wiki/RISC-V).";
    const citations = extractCitations(report);
    expect(citations).toHaveLength(1);
    expect(citations[0]!.url).toBe("https://en.wikipedia.org/wiki/RISC-V");
    expect(citations[0]!.citedText).toBe("source");
  });

  it("extracts reference-style [N] with Sources section", () => {
    const report = `RISC-V is open [1]. It was developed at Berkeley [1].

## Sources

[1]: https://en.wikipedia.org/wiki/RISC-V`;
    const citations = extractCitations(report);
    expect(citations).toHaveLength(1);
    expect(citations[0]!.url).toBe("https://en.wikipedia.org/wiki/RISC-V");
  });

  it("extracts plain URLs in text", () => {
    const report = "Visit https://github.com/riscv/riscv-isa-manual for details.";
    const citations = extractCitations(report);
    expect(citations.length).toBeGreaterThanOrEqual(1);
    expect(citations.some((c) => c.url === "https://github.com/riscv/riscv-isa-manual")).toBe(true);
  });

  it("deduplicates URLs", () => {
    const report = `[link](https://en.wikipedia.org/wiki/RISC-V) and [link2](https://en.wikipedia.org/wiki/RISC-V)`;
    const citations = extractCitations(report);
    expect(citations).toHaveLength(1);
  });

  it("returns empty array for no URLs", () => {
    const report = "This report has no citations at all.";
    const citations = extractCitations(report);
    expect(citations).toHaveLength(0);
  });

  it("handles multiple different URLs", () => {
    const report = `[wiki](https://en.wikipedia.org/wiki/RISC-V) and [github](https://github.com/riscv/riscv-isa-manual)`;
    const citations = extractCitations(report);
    expect(citations).toHaveLength(2);
  });

  it("handles URLs with query params", () => {
    const report = `[link](https://example.com/page?id=123&ref=abc)`;
    const citations = extractCitations(report);
    expect(citations).toHaveLength(1);
    expect(citations[0]!.url).toBe("https://example.com/page?id=123&ref=abc");
  });
});

// ---------- verifyCitation ----------

describe("verifyCitation", () => {
  it("returns verified when URL in sources and text matches", () => {
    const result = verifyCitation(
      "https://en.wikipedia.org/wiki/RISC-V",
      "RISC-V is a free and open standard instruction set architecture",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
    expect(result.supportsClaim).toBe("verified");
    expect(result.sourceTitle).toBe("RISC-V — Wikipedia");
  });

  it("returns unverified when URL in sources but text doesn't match", () => {
    const result = verifyCitation(
      "https://en.wikipedia.org/wiki/RISC-V",
      "The Eiffel Tower is in Paris and was built in 1889",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
    expect(result.supportsClaim).toBe("unverified");
  });

  it("returns unverified when URL not in sources", () => {
    const result = verifyCitation(
      "https://example.com/hallucinated",
      "Some claim",
      mockSources
    );
    expect(result.foundInSources).toBe(false);
    expect(result.supportsClaim).toBe("unverified");
  });

  it("returns verified when cited text is empty (just URL presence)", () => {
    const result = verifyCitation(
      "https://github.com/riscv/riscv-isa-manual",
      "",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
    expect(result.supportsClaim).toBe("verified");
  });

  it("returns unverified when source has no text", () => {
    const result = verifyCitation(
      "https://example.com/empty",
      "Some claim about this source",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
    expect(result.supportsClaim).toBe("unverified");
  });

  it("normalizes URLs (trailing slash)", () => {
    const result = verifyCitation(
      "https://en.wikipedia.org/wiki/RISC-V/",
      "RISC-V is a free and open standard",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
  });

  it("is case-insensitive for URL matching", () => {
    const result = verifyCitation(
      "HTTPS://EN.WIKIPEDIA.ORG/wiki/RISC-V",
      "RISC-V is a free and open standard",
      mockSources
    );
    expect(result.foundInSources).toBe(true);
  });
});

// ---------- verifyAllCitations ----------

describe("verifyAllCitations", () => {
  it("returns correct counts for mixed verification", () => {
    const report = `
# Report

RISC-V is open [source](https://en.wikipedia.org/wiki/RISC-V).
The Eiffel Tower is in Paris [hallucination](https://example.com/fake).
The manual is [here](https://github.com/riscv/riscv-isa-manual).
`;
    const report2 = report + "\n\n## Sources\n\n[1]: https://en.wikipedia.org/wiki/RISC-V";
    const result = verifyAllCitations(report, mockSources);

    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.verified).toBeGreaterThanOrEqual(1);
    expect(result.unverified).toBeGreaterThanOrEqual(1);
    expect(result.contradicts).toBe(0);
  });

  it("returns all verified for a clean report", () => {
    const report = `RISC-V is [open](https://en.wikipedia.org/wiki/RISC-V) and the [manual](https://github.com/riscv/riscv-isa-manual) is on GitHub.`;
    const result = verifyAllCitations(report, mockSources);

    expect(result.total).toBe(2);
    expect(result.verified).toBe(2);
    expect(result.unverified).toBe(0);
  });

  it("returns empty report for no citations", () => {
    const report = "This report has no URLs.";
    const result = verifyAllCitations(report, mockSources);

    expect(result.total).toBe(0);
    expect(result.verified).toBe(0);
    expect(result.unverified).toBe(0);
  });

  it("handles empty sources array", () => {
    const report = "[link](https://example.com/test)";
    const result = verifyAllCitations(report, []);

    expect(result.total).toBe(1);
    expect(result.verified).toBe(0);
    expect(result.unverified).toBe(1);
  });

  it("includes source excerpt in details for verified citations", () => {
    const report = "[RISC-V is open](https://en.wikipedia.org/wiki/RISC-V)";
    const result = verifyAllCitations(report, mockSources);

    const detail = result.details[0];
    expect(detail!.supportsClaim).toBe("verified");
    expect(detail!.sourceExcerpt).toBeTruthy();
    expect(detail!.sourceExcerpt!.length).toBeGreaterThan(0);
  });
});
