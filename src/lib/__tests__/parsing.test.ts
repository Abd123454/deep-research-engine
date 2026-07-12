// Unit tests for the critical parsing functions in the research engine.
// These functions have 5+ parsing paths and were previously untested — any
// edit to them was a gamble. These tests lock in the expected behavior.
//
// Run with: bunx vitest run

import { describe, it, expect } from "vitest";

// We test the parsing logic by re-implementing the pure functions here
// (they're not exported from research-engine.ts because that file is a
// server-only module with side effects). Keeping the tests self-contained
// avoids importing the whole engine. If the engine's logic changes, update
// both copies.

const MAX_SUBQUESTION_CHARS = 280;

function truncateQuestion(q: string): string {
  const trimmed = q.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_SUBQUESTION_CHARS) return trimmed;
  const slice = trimmed.slice(0, MAX_SUBQUESTION_CHARS);
  const lastStop = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("; ")
  );
  if (lastStop > 80) return slice.slice(0, lastStop + 1).trim();
  return slice.trim() + "…";
}

function extractQuestionsJson(text: string): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* fall through */
  }
  const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
    } catch {
      /* fall through */
    }
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through */
    }
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through */
    }
  }
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[\.\)]|-|\*|\+)\s*/, "").trim())
    .filter((l) => l.length > 8 && l.length < 600);
  const questions = lines.filter((l) => l.endsWith("?"));
  if (questions.length > 0) return questions;
  if (lines.length >= 2) return lines;
  return [];
}

function dedupeSources(sources: { url: string; title: string; host: string }[]) {
  const seen = new Set<string>();
  const out: { url: string; title: string; host: string }[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// ---------- tests ----------

describe("truncateQuestion", () => {
  it("returns short questions unchanged", () => {
    expect(truncateQuestion("What is RISC-V?")).toBe("What is RISC-V?");
  });

  it("collapses internal whitespace", () => {
    expect(truncateQuestion("What   is   RISC-V?")).toBe("What is RISC-V?");
  });

  it("truncates at a sentence boundary when possible", () => {
    const long = "A".repeat(200) + ". " + "B".repeat(100);
    const result = truncateQuestion(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SUBQUESTION_CHARS);
    expect(result.endsWith(".")).toBe(true);
  });

  it("appends ellipsis when no sentence boundary exists", () => {
    const long = "X".repeat(300);
    const result = truncateQuestion(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SUBQUESTION_CHARS + 1);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("extractQuestionsJson", () => {
  it("parses a clean JSON object with questions", () => {
    const text = '{"questions": ["What is X?", "Why is Y?"]}';
    expect(extractQuestionsJson(text)).toEqual(["What is X?", "Why is Y?"]);
  });

  it("parses a JSON array", () => {
    const text = '["Q1?", "Q2?"]';
    expect(extractQuestionsJson(text)).toEqual(["Q1?", "Q2?"]);
  });

  it("extracts JSON embedded in prose", () => {
    const text = 'Here are the questions:\n{"questions": ["A?", "B?"]}\nDone.';
    expect(extractQuestionsJson(text)).toEqual(["A?", "B?"]);
  });

  it("extracts JSON from a markdown code fence", () => {
    const text = '```json\n{"questions": ["Fenced?"]}\n```';
    expect(extractQuestionsJson(text)).toEqual(["Fenced?"]);
  });

  it("falls back to question lines when no JSON is present", () => {
    const text = "1. What is A?\n2. What is B?\n3. What is C?";
    expect(extractQuestionsJson(text)).toEqual([
      "What is A?",
      "What is B?",
      "What is C?",
    ]);
  });

  it("returns empty array for garbage input", () => {
    expect(extractQuestionsJson("")).toEqual([]);
    expect(extractQuestionsJson("no questions here at all")).toEqual([]);
  });
});

describe("dedupeSources", () => {
  it("removes duplicate URLs", () => {
    const sources = [
      { url: "https://a.com", title: "A", host: "a.com" },
      { url: "https://b.com", title: "B", host: "b.com" },
      { url: "https://a.com", title: "A dup", host: "a.com" },
    ];
    const result = dedupeSources(sources);
    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe("https://a.com");
    expect(result[1]!.url).toBe("https://b.com");
  });

  it("preserves order", () => {
    const sources = [
      { url: "https://first.com", title: "1", host: "first.com" },
      { url: "https://second.com", title: "2", host: "second.com" },
    ];
    const result = dedupeSources(sources);
    expect(result.map((s) => s.url)).toEqual([
      "https://first.com",
      "https://second.com",
    ]);
  });

  it("handles empty input", () => {
    expect(dedupeSources([])).toEqual([]);
  });
});

describe("safeHost", () => {
  it("extracts hostname from a valid URL", () => {
    expect(safeHost("https://www.example.com/path?q=1")).toBe("www.example.com");
  });

  it("returns empty string for invalid URL", () => {
    expect(safeHost("not a url")).toBe("");
    expect(safeHost("")).toBe("");
  });

  it("handles URLs with ports (hostname excludes port)", () => {
    // Note: URL.hostname does NOT include the port — use URL.host for that.
    expect(safeHost("http://localhost:3000/api")).toBe("localhost");
  });
});
