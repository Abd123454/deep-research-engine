// Quaesitor — Research engine pure helpers.
//
// Extracted from `src/lib/research-engine.ts` as part of the god-object
// refactoring pass (v7 audit fix). The original file was 1,592 lines;
// moving the pure parsing / question-truncation / language-instruction
// helpers here keeps `research-engine.ts` focused on pipeline orchestration.
//
// All functions in this module are PURE (no `job` mutation, no LLM calls,
// no I/O). They take primitive inputs and return primitive outputs. This
// makes them trivially testable in isolation — see `parsing.test.ts` for
// the parallel re-implementation that locks in their behavior.
//
// MOVE ONLY — behavior is byte-for-byte identical to the inline definitions
// that were in `research-engine.ts` before this refactor. The pipeline call
// sites import the same names from this module instead of resolving them
// lexically inside the same file.

import * as Sentry from "@sentry/nextjs";
import { logger } from "../logger";
import type {
  PlanSection,
  PageReadResult,
  DetectedLanguage,
} from "./types";

/**
 * Maximum character length for a single sub-question (web-search query).
 *
 * Sub-questions longer than this are truncated at a sentence boundary if
 * possible, otherwise hard-truncated with an ellipsis. 280 chars is well
 * below DuckDuckGo's URL length limit (~2,048) and keeps the LLM prompt
 * budget bounded when the LLM emits over-long sub-questions.
 */
export const MAX_SUBQUESTION_CHARS = 280;

/**
 * Truncate a sub-question to MAX_SUBQUESTION_CHARS, preferring a sentence
 * boundary (`. `, `? `, `! `, `; `) over a hard cut.
 *
 * Whitespace is collapsed (multiple spaces → single space) so the LLM's
 * occasional "Q1\n\nQ2" or "Q1  Q2" output is normalized before truncation.
 *
 * If no sentence boundary exists in the first 280 chars, the string is
 * hard-cut and an ellipsis `…` is appended (so the user can see the
 * question was truncated, not just mysteriously cut off).
 */
export function truncateQuestion(q: string): string {
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

/**
 * Parse the LLM's response to a "generate N sub-questions" prompt into a
 * clean array of question strings.
 *
 * The LLM is asked to return `{"questions": ["...", "..."]}` JSON, but in
 * practice it returns a wide variety of formats: JSON arrays, JSON objects
 * embedded in prose, fenced code blocks, or just numbered prose lines.
 * This function tries progressively looser extraction strategies until
 * one succeeds:
 *
 *   1. Direct JSON.parse(text) — happy path (object with `questions` or
 *      bare array).
 *   2. Substring match for `{"questions": [...]}` — JSON embedded in
 *      prose.
 *   3. Substring match for `[...]` — bare JSON array embedded in prose.
 *   4. Markdown fenced code block (` ```json...``` `) — LLM ignored the
 *      "no fences" instruction.
 *   5. Line-by-line heuristic — split on newlines, strip list markers
 *      (`1.`, `-`, `*`, `+`), keep lines that look like questions
 *      (end with `?`) or are 8–600 chars long.
 *
 * Returns an empty array if NO strategy yields any usable questions
 * (the caller falls back to `heuristicDecompose`).
 */
export function extractQuestionsJson(text: string): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (err) {
    // Non-critical: LLM returned malformed JSON. Try progressively looser
    // extraction strategies below (substring match, array match, fenced
    // code block). Debug-level because parsing failures are an expected
    // part of the strategy cascade.
    Sentry.captureException(err);
    logger.debug(
      { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
      "extractQuestionsJson: direct JSON.parse failed — trying looser strategies"
    );
  }
  const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
    } catch (err) {
      // Non-critical: extracted JSON-like substring was still malformed.
      // Continue to the next strategy (array match, fenced block, line split).
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "extractQuestionsJson: JSON-object substring parse failed"
      );
    }
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (err) {
      // Non-critical: extracted array-like substring was malformed.
      // Continue to the fenced-block and line-split strategies.
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "extractQuestionsJson: JSON-array substring parse failed"
      );
    }
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (err) {
      // Non-critical: fenced code block wasn't valid JSON. Fall through to
      // the line-by-line heuristic (last-resort extraction).
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "extractQuestionsJson: fenced-block parse failed — falling back to line split"
      );
    }
  }
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|-|\*|\+)\s*/, "").trim())
    .filter((l) => l.length > 8 && l.length < 600);
  const questions = lines.filter((l) => l.endsWith("?"));
  if (questions.length > 0) return questions;
  if (lines.length >= 2) return lines;
  return [];
}

/**
 * Fallback decomposition when the LLM fails entirely: split the user's
 * original query on headings (`1.`, `#`) or blank-line paragraphs.
 *
 * Returns between 1 and `numSubQueries` sub-questions. If neither split
 * strategy yields usable questions, the original query is returned as a
 * single-element array (truncated to MAX_SUBQUESTION_CHARS).
 */
export function heuristicDecompose(query: string, numSubQueries: number): string[] {
  const headingSplit = query.split(/\n\s*(?:\d+[.)]\s+|#{1,6}\s+)/);
  if (headingSplit.length >= 2) {
    return headingSplit
      .map((s) => truncateQuestion(s.replace(/\n+/g, " ").trim()))
      .filter((s) => s.length > 20)
      .slice(0, numSubQueries);
  }
  const paraSplit = query.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
  if (paraSplit.length >= 2) {
    return paraSplit
      .map((p) => truncateQuestion(p.replace(/\n+/g, " ").trim()))
      .filter((s) => s.length > 20)
      .slice(0, numSubQueries);
  }
  return [truncateQuestion(query)];
}

/**
 * Extract the hostname from a URL safely (returns "" for malformed URLs).
 *
 * Used by `processSubQuery` when building the per-source `host` field —
 * some search results come back without a `host_name` and we don't want
 * a thrown `URL` constructor to crash the entire sub-query.
 */
export function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Take the first `max` chars of a page's extracted text as a snippet.
 *
 * Snippets are stored on `Source` records so the UI can show a preview
 * without re-fetching the page. 600 chars is the default because longer
 * snippets bloat `job.sources` (which is serialized into the SSE stream
 * and the persistent DB row).
 */
export function snippetFromPage(p: PageReadResult, max = 600): string {
  return p.text.slice(0, max).trim();
}

/**
 * Parse the LLM's response to a "produce a research plan" prompt into a
 * validated `ResearchPlan` (title + summary + sections array).
 *
 * Tries three candidate substrings in order: the raw text, the contents of
 * a markdown fenced code block, and the largest `{...}` substring. Each
 * candidate is JSON.parsed and validated for the `{title, sections[]}`
 * shape; the first one that validates wins.
 *
 * Sections are normalized: each gets an `id` (`s1`, `s2`, ...), a trimmed
 * title (defaulting to `Section N` if missing), and a trimmed description.
 * The array is capped at 9 sections (plans longer than 9 sections become
 * unwieldy in the report outline).
 *
 * Returns `null` if NO candidate produces a valid plan shape.
 */
export function tryParsePlan(text: string): {
  title: string;
  summary: string;
  sections: PlanSection[];
} | null {
  const candidates: string[] = [];
  try {
    candidates.push(text);
  } catch (err) {
    // Non-critical: array push threw (extremely unlikely — only on OOM).
    // Skip the raw-text candidate; the fenced-block and object-match
    // candidates below are still tried.
    Sentry.captureException(err);
    logger.debug(
      { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
      "tryParsePlan: raw-text candidate push failed (OOM?)"
    );
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) candidates.push(fenceMatch[1]);
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.sections)) {
        const sections: PlanSection[] = parsed.sections
          .map((s: { title?: string; description?: string }, i: number) => ({
            id: `s${i + 1}`,
            title: String(s?.title ?? `Section ${i + 1}`).trim(),
            description: String(s?.description ?? "").trim(),
          }))
          .filter((s: PlanSection) => s.title.length > 0)
          .slice(0, 9);
        return {
          title: String(parsed.title).trim() || "Deep Research Report",
          summary: String(parsed.summary ?? "").trim(),
          sections,
        };
      }
    } catch (err) {
      // Non-critical: this candidate wasn't valid JSON (or didn't have the
      // required shape). Try the next candidate.
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "tryParsePlan: candidate parse failed — trying next"
      );
    }
  }
  return null;
}

/**
 * Build a fallback 4-section plan when the LLM's plan generation fails.
 *
 * If the query contains 3+ heading-like splits (numbered headings or
 * markdown `#` headings), they're used as section titles. Otherwise we
 * fall back to a fixed Overview / Key Findings / Analysis / Conclusion
 * outline — generic but always usable as a synthesis scaffold.
 */
export function deriveFallbackSections(query: string): PlanSection[] {
  const headingSplit = query
    .split(/\n\s*(?:\d+[.)]\s+|#{1,6}\s+)/)
    .map((s) => s.replace(/\n+/g, " ").trim())
    .filter((s) => s.length > 20)
    .slice(0, 9);
  if (headingSplit.length >= 3) {
    return headingSplit.map((s, i) => {
      const title = s.split(/[:.\-—]/)[0].slice(0, 80).trim() || `Section ${i + 1}`;
      return { id: `s${i + 1}`, title, description: s.slice(0, 160) };
    });
  }
  return [
    { id: "s1", title: "Overview & Background", description: "Foundational context and definitions." },
    { id: "s2", title: "Key Findings", description: "The core discoveries from the research." },
    { id: "s3", title: "Analysis & Implications", description: "What the findings mean in practice." },
    { id: "s4", title: "Conclusion", description: "Summary and outlook." },
  ];
}

/**
 * Return a `Respond in <language>` instruction string for the LLM system
 * prompt, based on the detected script of the user's query.
 *
 * Empty for English (the LLM defaults to English) and for `unknown`
 * (too few characters of any script to decide — let the LLM pick). For
 * Arabic / Chinese / Hebrew / Russian, an explicit instruction is appended
 * so the LLM writes the final report in the user's language.
 */
export function languageInstruction(lang: DetectedLanguage): string {
  switch (lang) {
    case "ar": return "\n\nIMPORTANT: Respond in Arabic. The user's query is in Arabic.";
    case "zh": return "\n\nIMPORTANT: Respond in Chinese. The user's query is in Chinese.";
    case "he": return "\n\nIMPORTANT: Respond in Hebrew. The user's query is in Hebrew.";
    case "ru": return "\n\nIMPORTANT: Respond in Russian. The user's query is in Russian.";
    default: return "";
  }
}
