// Quaesitor — Research engine types.
//
// Extracted from `src/lib/research-engine.ts` as part of the god-object
// refactoring pass (final-cleanup task). The original file was 1,595 lines;
// moving the type definitions here keeps `research-engine.ts` focused on
// pipeline logic.
//
// This module:
//   - Re-exports the shared research types from `src/lib/types.ts` so callers
//     can import everything from a single `@/lib/research` entry point.
//   - Defines `DetectedLanguage`, the only type that was previously defined
//     locally inside `research-engine.ts` (used by the language-detection
//     helper that picks the response language for the LLM).
//
// MOVE ONLY — no logic changes. Behavior is identical to the inline
// definitions that were in `research-engine.ts` before this refactor.

export type {
  ResearchConfig,
  ResearchJob,
  ResearchStatus,
  ResearchPlan,
  PlanSection,
  SubQuery,
  LogEntry,
  SearchResultItem,
  PageReadResult,
  SubQueryRound,
  Source,
  SubQueryStatus,
  SearchDepth,
  RetrieverType,
  LLMProvider,
  ThoughtEntry,
  ResearchStats,
  ResearchJobPublic,
} from "../types";

// Re-export the public-facing job helper too (it was previously only
// reachable via `@/lib/types`). The barrel in `./index.ts` re-exports
// this module's exports, so `import { toPublicJob } from "@/lib/research"`
// works for callers that want the canonical public-job shape.
export { toPublicJob } from "../types";

/**
 * The script family detected in the user's research query.
 *
 * Used by `detectLanguage()` in `research-engine.ts` to append a
 * language instruction to the LLM system prompt so the final report
 * is written in the same language as the query.
 *
 * Values:
 *   - "ar"      — Arabic (Unicode 0600–06FF)
 *   - "zh"      — Chinese / CJK (4E00–9FFF)
 *   - "he"      — Hebrew (0590–05FF)
 *   - "ru"      — Cyrillic / Russian (0400–04FF)
 *   - "en"      — Latin (default when ≥3 Latin chars detected)
 *   - "unknown" — too few characters of any script to decide
 */
export type DetectedLanguage = "ar" | "zh" | "he" | "ru" | "en" | "unknown";
