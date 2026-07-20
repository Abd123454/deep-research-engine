// Quaesitor — Research engine barrel.
//
// Re-exports the public surface of the deep-research pipeline so callers
// can import everything from a single entry point:
//
//   import {
//     runResearch,
//     generatePlan,
//     resolveConfig,
//     detectLanguage,
//     type ResearchJob,
//     type ResearchConfig,
//     BIAS_DISCLAIMER,
//   } from "@/lib/research";
//
// This module is part of the god-object refactoring pass
// (final-cleanup task). The actual pipeline logic still lives in
// `src/lib/research-engine.ts` — this file is a thin re-export layer
// that exposes the types + prompt constants + main entry points in one
// place. No logic is duplicated.

// Types (re-exported from `./types`, which itself re-exports from
// `../types` and defines `DetectedLanguage`).
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
  DetectedLanguage,
} from "./types";

export { toPublicJob } from "./types";

// Prompt constants (re-exported from `./prompts`).
export { BIAS_DISCLAIMER } from "./prompts";

// Pipeline entry points + helpers. Re-exported from the original
// `research-engine.ts` — the functions themselves were NOT moved (the
// pipeline is too tightly coupled to extract safely; the audit allowed
// the MINIMUM split of types + prompts only).
export {
  runResearch,
  generatePlan,
  resolveConfig,
  detectLanguage,
} from "../research-engine";
