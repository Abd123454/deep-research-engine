// Quaesitor — Deep Research Pipeline :: STAGE FUNCTIONS
//
// Extracted from `src/lib/research-engine.ts` (reach-10 task) to shrink the
// orchestrator file. This module hosts the 6 pipeline stage functions +
// their shared mutation helpers (log / think / setStatus / trackLLMTokens)
// + the pure utilities (detectLanguage / appendBiasDisclaimer).
//
// The orchestrator (`runResearch`) lives in `../research-engine.ts` and
// imports these stages. Tests import `generatePlan` / `detectLanguage`
// from `../research-engine.ts` (re-exported there for backward compat).
//
// Pipeline overview (the 6 stages):
//   1. PLAN       — structured outline
//   2. DECOMPOSE  — break the query into focused sub-questions
//   3. SEARCH     — per sub-query: web search
//   4. READ       — per sub-query: fetch + parse pages
//   5. GAP-ANALYSIS — review round-1 findings, identify what's missing
//   6. SYNTHESIZE — write the final long-form report following the plan
//
// (Stages 3+4 are bundled inside `processSubQuery` because they share
// per-sub-query state and abort-signal handling.)

import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "crypto";

import { getLLM, type LLMMessage } from "../llm-provider";
import { searchWeb } from "../retriever";
import { readPages } from "../page-reader";
import { persistJob } from "../research-store";
import { runWithConcurrency } from "../concurrency";
import { logger } from "../logger";
import {
  checkPromptInjection,
  wrapUserQuery,
  getInjectionDefensePrompt,
} from "../prompt-security";
// P0-6: Constitutional Self-Critique Pass — inline [verified] /
// [unverified] / [contradicted] markers added by a second LLM call.
import { SELF_CRITIQUE_PROMPT } from "../prompts/self-critique";
import type {
  ResearchConfig,
  ResearchJob,
  ResearchStatus,
  ResearchPlan,
  SubQuery,
  LogEntry,
  SearchResultItem,
  PageReadResult,
  SubQueryRound,
  Source,
  DetectedLanguage,
} from "./types";
import { BIAS_DISCLAIMER } from "./prompts";
import {
  truncateQuestion,
  extractQuestionsJson,
  heuristicDecompose,
  safeHost,
  snippetFromPage,
  deriveFallbackSections,
  tryParsePlan,
  languageInstruction,
} from "./helpers";

// ════════════════════════════════════════════════════════════════
// SHARED MUTATION HELPERS
// ════════════════════════════════════════════════════════════════
// Small job-mutating utilities used by every stage. They live here so
// the stages can be self-contained (no closure over `research-engine.ts`).

/**
 * Append a structured log entry to `job.logs`. The log ring buffer is
 * capped at 800 entries (older entries are spliced off the front).
 */
export function log(
  job: ResearchJob,
  level: LogEntry["level"],
  stage: ResearchStatus,
  message: string
) {
  const entry: LogEntry = { ts: Date.now(), level, stage, message };
  job.logs.push(entry);
  if (job.logs.length > 800) job.logs.splice(0, job.logs.length - 800);
  job.updatedAt = Date.now();
}

/**
 * Push a human-readable "thought" to the thinking panel.
 * Unlike `log()` (technical), these are written for the user to read.
 */
export function think(
  job: ResearchJob,
  stage: ResearchStatus,
  text: string,
  plan?: string
) {
  job.thoughts.push({ ts: Date.now(), stage, text, plan });
  if (job.thoughts.length > 100) job.thoughts.splice(0, job.thoughts.length - 100);
  job.updatedAt = Date.now();
}

/**
 * Set the job's status. When the status is terminal (`completed` or
 * `failed`), record `finishedAt` and compute `stats.elapsedMs`. Persists
 * the job so it survives server restarts (fire-and-forget).
 */
export function setStatus(job: ResearchJob, status: ResearchStatus) {
  job.status = status;
  job.updatedAt = Date.now();
  if (status === "completed" || status === "failed") {
    job.finishedAt = Date.now();
    if (job.startedAt) {
      job.stats.elapsedMs = job.finishedAt - job.startedAt;
    }
  }
  // Persist to DB so the job survives server restarts.
  // Fire-and-forget — failures are logged inside persistJob.
  persistJob(job);
}

/**
 * Accumulate `tokensUsed` from each LLM call into `job.stats.totalTokensUsed`.
 * Also tracks llmCalls count. NVIDIA free tier = $0 — estimatedCost stays 0.
 */
export function trackLLMTokens(job: ResearchJob, result: { tokensUsed?: number }): void {
  if (result.tokensUsed && result.tokensUsed > 0) {
    job.stats.totalTokensUsed += result.tokensUsed;
    job.stats.outputTokens += result.tokensUsed;
  }
  job.stats.llmCalls += 1;
  // NVIDIA free tier = $0. When multi-provider is added, the provider
  // will set the cost per call. For now, all calls are free.
  // job.stats.estimatedCost stays 0 for NVIDIA.
}

// ════════════════════════════════════════════════════════════════
// PURE UTILITIES
// ════════════════════════════════════════════════════════════════

/**
 * Detects the dominant script of the query so the LLM can respond in the
 * same language. Uses Unicode ranges: Arabic (0600-06FF), CJK (4E00-9FFF),
 * Hebrew (0590-05FF), Cyrillic (0400-04FF).
 */
export function detectLanguage(text: string): DetectedLanguage {
  const sample = text.slice(0, 500);
  const counts: Record<string, number> = { ar: 0, zh: 0, he: 0, ru: 0, latin: 0 };
  for (const ch of sample) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0600 && code <= 0x06ff) counts.ar++;
    else if (code >= 0x4e00 && code <= 0x9fff) counts.zh++;
    else if (code >= 0x0590 && code <= 0x05ff) counts.he++;
    else if (code >= 0x0400 && code <= 0x04ff) counts.ru++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) counts.latin++;
  }
  // Require at least 3 non-Latin chars to switch language.
  if (counts.ar >= 3) return "ar";
  if (counts.zh >= 3) return "zh";
  if (counts.he >= 3) return "he";
  if (counts.ru >= 3) return "ru";
  if (counts.latin >= 3) return "en";
  return "unknown";
}

/**
 * Splice the bias disclaimer onto the end of the final report. Idempotent
 * — if the disclaimer is already present (e.g. a future code path calls
 * this twice), the report is returned unchanged. The disclaimer is added
 * AFTER the self-critique pass so the LLM doesn't "review" it.
 */
export function appendBiasDisclaimer(report: string): string {
  if (!report) return report;
  // Don't double-append if a future code path calls this twice.
  if (report.includes("⚠️ **Bias notice**")) return report;
  return report.trimEnd() + "\n" + BIAS_DISCLAIMER;
}

// ════════════════════════════════════════════════════════════════
// STAGE 1: PLANNING
// ════════════════════════════════════════════════════════════════

export async function generatePlan(
  job: ResearchJob,
  config: ResearchConfig
): Promise<ResearchPlan & { llmFailed?: boolean; llmError?: string }> {
  setStatus(job, "planning");
  log(job, "info", "planning", "Creating a research plan...");

  const llm = await getLLM();
  const queryLen = config.query.length;
  const isGiant = queryLen > 4000;

  // Prompt-injection defense: wrap the user query in XML tags + warn the LLM.
  const injectionCheck = checkPromptInjection(config.query);
  if (injectionCheck.isSuspicious) {
    log(
      job,
      "warn",
      "planning",
      `Possible prompt injection detected (matched: ${injectionCheck.matchedPatterns.join(", ")}). Query will be wrapped + LLM warned.`
    );
  }

  const detectedLang = detectLanguage(config.query);

  const sys: LLMMessage = {
    role: "system",
    content:
      "You are a senior research director. Given a research query, you produce a clear, well-structured research plan: a working title, a one-paragraph summary of what the report will cover, and a list of thematic sections (each with a title and a one-sentence description). The sections should collectively cover the topic exhaustively and flow logically. For long briefs, ensure every distinct topic mentioned is represented as a section." +
      getInjectionDefensePrompt() +
      languageInstruction(detectedLang),
  };
  const user: LLMMessage = {
    role: "user",
    content: `Research query / brief:
${wrapUserQuery(config.query)}

Produce a research plan as JSON with this exact shape (no markdown, no preamble):
{
  "title": "A concise working title for the report",
  "summary": "One paragraph (2-4 sentences) describing what the final report will cover.",
  "sections": [
    {"title": "Section title", "description": "One sentence describing what this section covers."},
    ...
  ]
}

Generate between 5 and 9 sections. Return ONLY the JSON object.`,
  };

  let plan: ResearchPlan | null = null;
  let llmFailed = false;
  let llmError = "";

  try {
    const result = await llm.smart({
      messages: [sys, user],
      maxTokens: isGiant ? 2500 : 1800,
      temperature: 0.4,
      json: true,
    });
    trackLLMTokens(job, result);

    // Try to parse the plan JSON.
    const parsed = tryParsePlan(result.content);
    if (parsed) plan = parsed;
    else {
      // LLM succeeded but output wasn't parseable JSON.
      llmFailed = true;
      llmError = `LLM returned unparseable plan (preview: ${result.content.slice(0, 150)})`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    llmFailed = true;
    llmError = msg;
    log(job, "warn", "planning", `Plan generation failed: ${msg}`);
  }

  // Fallback: if LLM failed or produced no sections, derive them heuristically.
  // NOTE: This fallback is allowed in runResearch (so a long-running job still
  // produces something), but the /api/research/plan endpoint should check
  // `llmFailed` and return 503 to avoid silent failure.
  if (!plan || plan.sections.length === 0) {
    plan = {
      title: "Deep Research Report",
      summary: "",
      sections: deriveFallbackSections(config.query),
    };
  }

  job.plan = plan;
  log(job, "success", "planning", `Research plan ready: "${plan.title}" (${plan.sections.length} sections)`);
  think(job, "planning",
    `I've created a research plan with ${plan.sections.length} sections covering: ${plan.sections.map(s => s.title).join(", ")}.`,
    "Now I'll break this into specific search queries and start researching."
  );
  plan.sections.forEach((s, i) =>
    log(job, "info", "planning", `  ${i + 1}. ${s.title}`)
  );

  return { ...plan, llmFailed, llmError };
}

// ════════════════════════════════════════════════════════════════
// STAGE 2: DECOMPOSITION
// ════════════════════════════════════════════════════════════════

export async function decompose(
  job: ResearchJob,
  config: ResearchConfig,
  round: SubQueryRound,
  count: number,
  rationale?: string
): Promise<SubQuery[]> {
  setStatus(job, "decomposing");
  const roundLabel = round === 2 ? "Round 2 (gap-filling)" : "Round 1";
  log(job, "info", "decomposing", `Generating ${count} sub-questions (${roundLabel})...`);

  const llm = await getLLM();
  const queryLen = config.query.length;
  const isGiant = queryLen > 4000;
  const isMega = queryLen > 15000;

  // For round 2, include the gap analysis as context.
  const gapContext = round === 2 && job.gapAnalysis ? `\n\n# Gap analysis from round 1\n${job.gapAnalysis}\n\nGenerate sub-questions that specifically fill the gaps identified above.` : "";

  const sys: LLMMessage = {
    role: "system",
    content:
      "You are a senior research strategist and domain expert. Your task is to break a complex research query into focused, diverse, non-redundant sub-questions that together will fully cover the topic. Each sub-question must be specific enough to be answerable via web search.\n\nEach sub-question MUST be a concise, self-contained web search query of at most 250 characters. Do NOT paste long briefs into the sub-questions. Distill each topic to its essence.",
  };
  const user: LLMMessage = {
    role: "user",
    content: `Research query / brief:
"""
${config.query}
"""
${gapContext}

Generate exactly ${count} sub-questions that, when researched thoroughly, will enable writing a comprehensive long-form report covering EVERY aspect mentioned above.

Rules for each sub-question:
- Must be a concise web search query (max 250 characters).
- Must be self-contained (no references to "the above" or "section 3").
- Must target a specific, searchable facet of the topic.

Return ONLY a JSON object with this exact shape (no markdown fences, no preamble, no commentary):
{"questions": ["...", "...", ...]}`,
  };

  const maxTokens = isMega ? 4000 : isGiant ? 2500 : 1500;

  let rawQuestions: string[] = [];
  let llmError: string | null = null;

  try {
    const result = await llm.smart({
      messages: [sys, user],
      maxTokens,
      temperature: 0.5,
      json: true,
    });
    trackLLMTokens(job, result);
    rawQuestions = extractQuestionsJson(result.content);
    if (rawQuestions.length === 0) {
      llmError = `LLM returned no parseable questions. Preview: ${result.content.slice(0, 200)}`;
    }
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
    log(job, "warn", "decomposing", `LLM decomposition call failed: ${llmError}`);
  }

  let questions = rawQuestions
    .map((q) => truncateQuestion(q))
    .filter((q) => q.length > 0)
    .slice(0, count);

  if (questions.length === 0) {
    log(
      job,
      "warn",
      "decomposing",
      `LLM decomposition yielded no usable questions. Falling back to heuristic decomposition.${llmError ? " (" + llmError + ")" : ""}`
    );
    questions = heuristicDecompose(config.query, count);
  }

  if (questions.length < Math.min(3, count)) {
    const extra = heuristicDecompose(config.query, count);
    const seen = new Set(questions.map((q) => q.toLowerCase().slice(0, 60)));
    for (const q of extra) {
      const key = q.toLowerCase().slice(0, 60);
      if (!seen.has(key)) {
        questions.push(q);
        seen.add(key);
      }
      if (questions.length >= count) break;
    }
  }

  if (questions.length === 0) {
    questions = [truncateQuestion(config.query) || config.query.slice(0, 280)];
  }

  const newSubQueries: SubQuery[] = questions.map((q) => ({
    id: randomUUID(),
    question: q,
    status: "pending",
    round,
    rationale: round === 2 ? rationale : undefined,
    searchResults: [],
    pagesRead: 0,
    pagesSucceeded: 0,
    keyFindings: "",
  }));

  job.subQueries.push(...newSubQueries);

  log(job, "success", "decomposing", `Generated ${newSubQueries.length} sub-questions (${roundLabel}).`);
  newSubQueries.forEach((sq, i) =>
    log(job, "info", "decomposing", `  Q${i + 1} [R${round}]. ${sq.question}`)
  );

  return newSubQueries;
}

// ════════════════════════════════════════════════════════════════
// STAGES 3+4+5 (per sub-query): SEARCH → READ → EXTRACT FINDINGS
// ════════════════════════════════════════════════════════════════

export async function processSubQuery(
  job: ResearchJob,
  sq: SubQuery,
  config: ResearchConfig,
  jobSeenUrls: Set<string>
): Promise<void> {
  sq.status = "searching";
  sq.startedAt = Date.now();
  job.updatedAt = Date.now();

  const searchQuery =
    sq.question.length > 400 ? truncateQuestion(sq.question) : sq.question;
  if (searchQuery !== sq.question) {
    log(job, "warn", "searching", `Sub-question truncated for web search: "${searchQuery}"`);
  }
  const roundTag = sq.round === 2 ? "[R2] " : "";
  log(job, "info", "searching", `Searching ${roundTag}"${searchQuery}"`);

  // Use the job's AbortSignal for real cancellation. When the user clicks
  // Stop, abort() is called and in-flight fetch requests throw immediately.
  const signal = job.abortController?.signal;

  let results: SearchResultItem[] = [];
  try {
    results = await searchWeb(searchQuery, config.maxLinksPerQuery, signal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (signal?.aborted) {
      sq.status = "failed";
      sq.error = "cancelled";
      sq.finishedAt = Date.now();
      throw new Error("Cancelled by user");
    }
    sq.status = "failed";
    sq.error = msg;
    sq.finishedAt = Date.now();
    job.updatedAt = Date.now();
    log(job, "error", "searching", `Search failed ${roundTag}"${searchQuery}": ${msg}`);
    return;
  }

  sq.searchResults = results;
  job.stats.totalPagesFound += results.length;
  job.updatedAt = Date.now();
  log(job, "success", "searching", `Found ${results.length} results ${roundTag}for: "${sq.question}"`);

  if (results.length === 0) {
    sq.status = "done";
    sq.finishedAt = Date.now();
    job.updatedAt = Date.now();
    job.stats.subQueriesCompleted += 1;
    return;
  }

  sq.status = "reading";
  setStatus(job, "reading");
  log(job, "info", "reading", `Reading up to ${results.length} pages ${roundTag}for: "${sq.question}"`);

  const urls = results.slice(0, config.maxLinksPerQuery).map((r) => r.url);
  const pages = await readPages(urls, config.pageReadConcurrency, signal);

  // If aborted during page reads, throw.
  if (signal?.aborted) {
    throw new Error("Cancelled by user");
  }

  sq.pagesRead = pages.length;
  sq.pagesSucceeded = pages.filter((p) => p.success).length;
  job.stats.totalPagesRead += pages.length;
  job.stats.totalPagesSucceeded += sq.pagesSucceeded;
  job.stats.totalTokensUsed += pages.reduce((sum, p) => sum + (p.tokensUsed || 0), 0);
  job.updatedAt = Date.now();

  // dedupe by URL across the WHOLE JOB — different sub-queries often return
  // the same Wikipedia/GitHub article, and adding it to job.sources multiple
  // times inflates the source count and wastes report tokens.
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const r = results[i];
    if (jobSeenUrls.has(p.url)) continue;
    jobSeenUrls.add(p.url);
    job.sources.push({
      url: p.url,
      title: p.title || r?.name || p.url,
      host: r?.host_name || safeHost(p.url),
      snippet: r?.snippet || "",
      subQueryId: sq.id,
      round: sq.round,
      publishedTime: p.publishedTime,
      excerpt: p.success ? snippetFromPage(p) : "",
      tokensUsed: p.tokensUsed,
      wordCount: p.wordCount,
    });
  }

  log(
    job,
    "success",
    "reading",
    `Read ${sq.pagesRead} pages (${sq.pagesSucceeded} usable) ${roundTag}for: "${sq.question}"`
  );

  sq.status = "extracting";
  setStatus(job, "extracting");
  log(job, "info", "extracting", `Extracting findings ${roundTag}for: "${sq.question}"`);

  const successfulPages = pages.filter((p) => p.success && p.text.length > 200);
  const findings = await extractFindings(job, sq.question, successfulPages);
  sq.keyFindings = findings;
  sq.status = "done";
  sq.finishedAt = Date.now();
  job.stats.subQueriesCompleted += 1;

  log(job, "success", "extracting", `Findings extracted ${roundTag}for: "${sq.question}" (${findings.length} chars)`);
}

/**
 * Per-sub-query findings extraction. Batches pages to keep prompt size
 * bounded (BATCH_CHAR_LIMIT = 8000 chars). Bounded concurrency (3) to
 * respect the NVIDIA free-tier rate limit.
 */
export async function extractFindings(
  job: ResearchJob,
  question: string,
  pages: PageReadResult[]
): Promise<string> {
  if (pages.length === 0) return "";

  const llm = await getLLM();

  const BATCH_CHAR_LIMIT = 8000;
  const batches: PageReadResult[][] = [];
  let current: PageReadResult[] = [];
  let currentLen = 0;
  for (const p of pages) {
    const chunkLen = Math.min(p.text.length, 4000);
    if (currentLen + chunkLen > BATCH_CHAR_LIMIT && current.length > 0) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(p);
    currentLen += chunkLen;
  }
  if (current.length > 0) batches.push(current);

  // Process ALL batches with BOUNDED concurrency (was unbounded
  // Promise.all — 7b v5 audit fix). A research job with 8 batches
  // would fire 8 simultaneous LLM calls, blowing the NVIDIA free-tier
  // rate limit (3 concurrent). Cap at 3 to respect provider limits;
  // batches run sequentially in groups of 3, which is still ~3×
  // faster than fully-serial.
  const batchResults = await runWithConcurrency(
    batches,
    async (batch, bi) => {
      const context = batch
        .map((p, i) => {
          const snippet = p.text.slice(0, 3000).trim();
          return `### Source ${i + 1}\nURL: ${p.url}\nTitle: ${p.title}\n\n${snippet}`;
        })
        .join("\n\n---\n\n");

      const sys: LLMMessage = {
        role: "system",
        content:
          "You are a meticulous research analyst. Extract factual, citable findings from the provided sources that are directly relevant to the research question. Preserve specific numbers, dates, names, and claims. For each finding, include the source URL. Be concise but information-dense. Do not invent information not present in the sources.",
      };
      const user: LLMMessage = {
        role: "user",
        content: `Research question: "${question}"

Sources:
${context}

Extract the key findings as a markdown list. Each item should start with "- " and end with the source URL in parentheses, e.g.:
- <finding with specific facts> (https://...)`,
      };

      try {
        const result = await llm.smart({
          messages: [sys, user],
          maxTokens: 1200,
          temperature: 0.2,
        });
        trackLLMTokens(job, result);
        return result.content;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `_(Extraction failed for batch ${bi + 1}: ${msg})_`;
      }
    },
    3,
  );

  return batchResults.join("\n\n");
}

// ════════════════════════════════════════════════════════════════
// STAGE 5: GAP ANALYSIS (the key differentiator)
// ════════════════════════════════════════════════════════════════

export async function analyzeGaps(
  job: ResearchJob,
  config: ResearchConfig
): Promise<string> {
  setStatus(job, "analyzing_gaps");
  log(job, "info", "analyzing_gaps", "Analyzing findings to identify knowledge gaps...");

  const llm = await getLLM();

  const findingsBlock = job.subQueries
    .filter((sq) => sq.round === 1)
    .map((sq, i) => {
      const findings = sq.keyFindings || "_(no findings extracted)_";
      return `## Sub-question ${i + 1}: ${sq.question}\n\n${findings}`;
    })
    .join("\n\n---\n\n");

  const planSections = job.plan
    ? job.plan.sections.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join("\n")
    : "";

  const sys: LLMMessage = {
    role: "system",
    content:
      "You are a critical research reviewer. You are given a research plan and the findings gathered so far. Your job is to identify GAPS: what's missing, what's under-supported, what claims need more evidence, what angles weren't explored, and what recent developments or counter-arguments should be checked. Be specific and actionable.",
  };
  const user: LLMMessage = {
    role: "user",
    content: `# Original research query
${config.query}

# Research plan (target sections)
${planSections || "_(no plan)_"}

# Findings gathered so far (round 1)
${findingsBlock}

# Task
Review the findings against the research plan and the original query. Identify the most important GAPS in coverage, evidence, or perspective. Then suggest ${config.numGapQueries} specific, web-searchable follow-up questions that would fill these gaps.

Return your response as JSON with this exact shape (no markdown, no preamble):
{
  "gaps": "A concise analysis (2-4 sentences) of what's missing.",
  "follow_ups": ["question 1", "question 2", ...]
}`,
  };

  let gapAnalysis = "";
  let followUps: string[] = [];

  try {
    const result = await llm.smart({
      messages: [sys, user],
      maxTokens: 1500,
      temperature: 0.3,
      json: true,
    });
    trackLLMTokens(job, result);

    // Try to parse JSON.
    try {
      const parsed = JSON.parse(result.content);
      if (typeof parsed.gaps === "string") gapAnalysis = parsed.gaps;
      if (Array.isArray(parsed.follow_ups)) {
        followUps = parsed.follow_ups
          .map((q: unknown) => truncateQuestion(String(q)))
          .filter((q: string) => q.length > 0);
      }
    } catch (err) {
      // Non-critical: gap-analysis JSON parse failed (LLM returned prose
      // instead of JSON). Fall back to using the raw text as the gap
      // analysis — the report still synthesizes correctly, just without
      // the structured follow_ups list.
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "analyzeGaps: JSON parse failed — using raw text as gapAnalysis"
      );
      gapAnalysis = result.content.slice(0, 1000);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(job, "warn", "analyzing_gaps", `Gap analysis failed: ${msg}`);
  }

  job.gapAnalysis = gapAnalysis;
  log(
    job,
    "success",
    "analyzing_gaps",
    `Gap analysis complete. Identified ${followUps.length} follow-up questions.`
  );
  if (gapAnalysis) {
    log(job, "info", "analyzing_gaps", `Gaps: ${gapAnalysis.slice(0, 200)}`);
  }
  think(job, "analyzing_gaps",
    `I reviewed all findings from round 1. ${gapAnalysis ? gapAnalysis.slice(0, 150) : "I identified areas that need more research."}`,
    followUps.length > 0 ? `I'll search ${followUps.length} additional questions to fill the gaps.` : "The research is comprehensive enough. Moving to synthesis."
  );

  // Store the follow-ups on the job (proper field, not a type-assertion hack).
  job.round2FollowUps = followUps;
  return gapAnalysis;
}

// ════════════════════════════════════════════════════════════════
// P0-6: CONSTITUTIONAL SELF-CRITIQUE PASS
// ════════════════════════════════════════════════════════════════
//
// After the existing rewrite-style critique pass (which may improve prose
// clarity and catch missing citations), a SECOND LLM call analyzes the
// report's factual claims and inserts inline markers:
//
//   [verified]     — the cited source directly supports the claim
//   [unverified]   — the source is cited but doesn't clearly support it
//   [contradicted] — the source contradicts the claim
//
// This pass is NON-DESTRUCTIVE: it must not remove content or add new
// claims, only insert markers. The output is subject to a length-ratio
// guard (0.9x–1.6x of the input) — if the LLM ignores instructions and
// rewrites or truncates the report, the original is returned unchanged.
//
// Wrapped in try/catch at the call site — if the LLM call fails, the
// original report is used (the user is never blocked by a critique error).
//
// The annotated report is saved as `job.report` (the user-facing version).
// The streamed tokens (`job.reportStream`) are unaffected — they're the
// raw LLM output without markers.

export async function selfCritiquePass(
  report: string,
  sources: Source[],
  llm: Awaited<ReturnType<typeof getLLM>>,
  config: ResearchConfig
): Promise<string> {
  // Skip when the report is too short to contain factual claims worth
  // annotating. 500 chars matches the existing rewrite-critique gate.
  if (!report || report.length < 500) return report;
  // Skip when there are no sources to verify against — without sources
  // the LLM has nothing to cross-reference and would just parrot the
  // report back (or hallucinate markers).
  if (!sources || sources.length === 0) return report;

  // Build a numbered source index the LLM can map [N] citations to.
  // Only sources with an excerpt/text are useful for verification.
  const sourcesBlock = sources
    .filter((s) => s.excerpt || s.url)
    .slice(0, 40) // cap to keep prompt size bounded
    .map((s, i) => {
      const excerpt = (s.excerpt || "").slice(0, 400);
      const date = s.publishedTime ? ` (${s.publishedTime.slice(0, 10)})` : "";
      return `[${i + 1}] ${s.title || "(untitled)"}${date} — ${s.host}\n    URL: ${s.url}\n    Excerpt: ${excerpt || "(no excerpt available)"}`;
    })
    .join("\n");

  if (!sourcesBlock) return report;

  const sys: LLMMessage = {
    role: "system",
    content: SELF_CRITIQUE_PROMPT,
  };
  const user: LLMMessage = {
    role: "user",
    content: `${SELF_CRITIQUE_PROMPT}${report}\n\n# Source Index\n${sourcesBlock}\n\n# Task\nAnnotate the report above with inline [verified] / [unverified] / [contradicted] markers based on the source index. Return the FULL report with markers — do not truncate, do not summarize, do not add new claims.`,
  };

  const result = await llm.smart({
    messages: [sys, user],
    maxTokens: Math.min(config.reportMaxTokens + 1500, 16000),
    temperature: 0.2, // low temperature — fact-checking should be deterministic
  });

  const annotated = result.content;

  // Guard: reject outputs that don't preserve the report's structure.
  // The annotated version should be slightly LONGER than the original
  // (markers add chars) but never substantially shorter or absurdly
  // longer. Accept 0.9x–1.6x of the original length.
  const ratio = annotated.length / report.length;
  if (annotated.length < 200 || ratio < 0.9 || ratio > 1.6) {
    return report;
  }

  // Guard: must contain at least one marker (otherwise the LLM didn't
  // do the task). Also reject if it lost more than 30% of the original
  // section headings (a heuristic for "rewrote instead of annotated").
  const markerCount = (annotated.match(/\[(?:verified|unverified|contradicted)\]/g) || []).length;
  if (markerCount === 0) {
    return report;
  }
  const originalHeadings = (report.match(/^#{1,6}\s/gm) || []).length;
  const annotatedHeadings = (annotated.match(/^#{1,6}\s/gm) || []).length;
  if (originalHeadings > 0 && annotatedHeadings < originalHeadings * 0.7) {
    return report;
  }

  return annotated;
}

// ════════════════════════════════════════════════════════════════
// STAGE 6: SYNTHESIS
// ════════════════════════════════════════════════════════════════

export async function synthesizeReport(
  job: ResearchJob,
  config: ResearchConfig
): Promise<string> {
  setStatus(job, "synthesizing");
  log(job, "info", "synthesizing", "Writing the comprehensive final report...");
  think(job, "synthesizing",
    `I've gathered enough information across ${job.subQueries.length} sub-questions and ${job.stats.roundsCompleted} round(s). Now I'm writing the comprehensive report.`,
    "The report will follow the plan outline and include inline citations."
  );

  const llm = await getLLM();

  const findingsBlock = job.subQueries
    .map((sq, i) => {
      const roundTag = sq.round === 2 ? " [gap-fill]" : "";
      const findings = sq.keyFindings || "_(no findings extracted)_";
      return `## Sub-question ${i + 1}${roundTag}: ${sq.question}\n\n${findings}`;
    })
    .join("\n\n---\n\n");

  const sourcesBlock = job.sources
    .filter((s) => s.excerpt)
    .map((s, i) => {
      const date = s.publishedTime ? ` (${s.publishedTime.slice(0, 10)})` : "";
      return `[${i + 1}] ${s.title}${date} — ${s.host}\n    ${s.url}`;
    })
    .join("\n");

  const planOutline = job.plan
    ? `# Report Outline (follow this structure)
Title: ${job.plan.title}
Summary: ${job.plan.summary}

Sections:
${job.plan.sections.map((s, i) => `${i + 1}. ${s.title} — ${s.description}`).join("\n")}`
    : "";

  const detectedLang = detectLanguage(config.query);

  const sys: LLMMessage = {
    role: "system",
    content: `You are an elite research analyst and long-form writer, comparable to a senior journalist at a top-tier publication combined with a domain expert. You synthesize raw research notes into comprehensive, well-structured, deeply informative reports that surpass what single-pass research tools produce.

Your report MUST:
- Be written in clear, professional prose (use the SAME language as the user's query).
- Be long-form and comprehensive — this is a "Deep Research" report. Aim for depth, not brevity.
- Use Markdown with a clear hierarchy: # H1 title, ## section headings, ### subsections.
- Follow the provided report outline structure closely.
- Open with a concise executive summary (TL;DR) as a dedicated section.
- Cover all major facets discovered across ALL sub-questions (both rounds).
- Integrate gap-filling findings from round 2 where they add value.
- Include specific facts, numbers, dates, and named entities from the sources.
- Cite sources inline using markdown link syntax: [text](url) — only use URLs that appear in the provided source list.
- Include a "## Sources" section at the end listing all cited URLs.
- Acknowledge uncertainty or conflicting evidence where present.
- Avoid filler, fluff, and repetition. Every paragraph should add information.

Do NOT fabricate sources or URLs. Only cite URLs that appear in the provided source list.` +
      getInjectionDefensePrompt() +
      languageInstruction(detectedLang),
  };

  const user: LLMMessage = {
    role: "user",
    content: `# Original Research Query
${wrapUserQuery(config.query)}

${planOutline}

# Research Configuration
- Depth: ${config.depth}
- Rounds completed: ${job.stats.roundsCompleted}
- Sub-questions explored: ${job.subQueries.length}
- Pages read: ${job.stats.totalPagesRead} (${job.stats.totalPagesSucceeded} with usable content)

${job.gapAnalysis ? `# Gap analysis notes\n${job.gapAnalysis}\n` : ""}

# Extracted Findings (per sub-question; [gap-fill] = round-2 gap-filling)
${findingsBlock}

# Source Index (cite only these URLs)
${sourcesBlock || "_(no sources available)_"}

# Task
Write a comprehensive long-form Deep Research report answering the original query, following the report outline and synthesizing ALL the findings above (including gap-fill findings). Target length: roughly ${config.reportMaxTokens} tokens. Use Markdown. Include an executive summary, the sections from the outline, and inline citations to the source URLs. End with a "## Sources" section.`,
  };

  // stream the report tokens via onToken callback.
  // The tokens are pushed to job.reportStream, which the SSE endpoint
  // reads and emits as "report_token" events to the client.
  job.reportStreaming = true;
  job.reportStream = [];

  const result = await llm.smart({
    messages: [sys, user],
    maxTokens: config.reportMaxTokens,
    temperature: 0.4,
    stream: true,
    onToken: (token: string) => {
      job.reportStream.push(token);
    },
  });
  trackLLMTokens(job, result);

  job.reportStreaming = false;
  log(job, "success", "synthesizing", `Report written (${result.content.length} chars).`);
  think(job, "synthesizing",
    `Report complete — ${result.content.length} characters with citations from ${job.sources.length} sources.`
  );

  // self-critique pass: ask the LLM to review its own report for accuracy,
  // clarity, and completeness. If it finds issues, rewrite.
  let finalReport = result.content;
  if (result.content.length > 500) {
    try {
      think(job, "synthesizing", "Reviewing the report for accuracy and completeness...");
      const critiqueResult = await llm.smart({
        messages: [
          { role: "system", content: "You are a meticulous research editor. Review the report for factual errors, missing citations, unclear sections, and logical gaps. If the report is good, return it unchanged. If it needs fixes, return the improved version. Return ONLY the report markdown, no commentary." },
          { role: "user", content: `Original query: ${config.query}\n\nReport to review:\n\n${result.content}` },
        ],
        maxTokens: config.reportMaxTokens,
        temperature: 0.3,
      });
      trackLLMTokens(job, critiqueResult);
      // Use the revision IF it's substantial (not degenerate).
      // Length ratio must be between 0.7x and 1.5x of the original.
      const lengthRatio = critiqueResult.content.length / result.content.length;
      if (critiqueResult.content.length > 200 && lengthRatio > 0.7 && lengthRatio < 1.5) {
        finalReport = critiqueResult.content;
        const delta = finalReport.length - result.content.length;
        const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
        log(job, "success", "synthesizing", `Self-critique pass revised report (${finalReport.length} chars, was ${result.content.length}, ${deltaStr})`);
        think(job, "synthesizing", `Report reviewed and revised. Final version: ${finalReport.length} characters.`);
      } else {
        log(job, "warn", "synthesizing", `Self-critique revision rejected (length ratio ${lengthRatio.toFixed(2)}), keeping original`);
      }
    } catch (err) {
      log(job, "warn", "synthesizing", `Self-critique pass failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Generate follow-up questions for the user.
  try {
    const fqSys: LLMMessage = {
      role: "system",
      content: "You are a research assistant. Given a research report, generate 3 follow-up questions that would help the user dig deeper into the topic. Return ONLY a JSON array of strings.",
    };
    const fqUser: LLMMessage = {
      role: "user",
      content: `Report title: ${job.plan?.title || "Research Report"}\n\nReport excerpt (first 1000 chars):\n${result.content.slice(0, 1000)}\n\nGenerate 3 follow-up questions as a JSON array: ["question 1", "question 2", "question 3"]`,
    };
    const fqResult = await llm.fast({ messages: [fqSys, fqUser], maxTokens: 300, temperature: 0.5, json: true });
    trackLLMTokens(job, fqResult);
    try {
      const parsed = JSON.parse(fqResult.content);
      if (Array.isArray(parsed)) {
        job.followUpQuestions = parsed.map(String).slice(0, 3);
      }
    } catch (err) {
      // Non-critical: follow-up questions JSON parse failed (LLM returned
      // prose or malformed JSON). The report is already complete — follow-
      // ups are a nice-to-have, not a hard requirement.
      Sentry.captureException(err);
      logger.debug(
        { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
        "generateFollowUps: JSON parse failed — leaving followUpQuestions empty"
      );
    }
  } catch (err) {
    // Non-critical: the entire follow-up-question LLM call failed (rate
    // limit, network, provider outage). The report itself is unaffected —
    // follow-ups are surfaced in the UI as a separate optional section.
    Sentry.captureException(err);
    logger.warn(
      { module: "research-engine", err: err instanceof Error ? err.message : String(err) },
      "generateFollowUps: LLM call failed — skipping follow-up questions"
    );
  }

  // P0-6: Constitutional Self-Critique Pass — a SECOND LLM call annotates
  // the report with inline [verified] / [unverified] / [contradicted]
  // markers based on the cited sources. Runs AFTER the rewrite-style
  // critique pass and AFTER follow-up question generation (so follow-ups
  // see the original, unannotated prose) and BEFORE the bias disclaimer
  // (so the disclaimer isn't itself "fact-checked"). Wrapped in
  // try/catch — if the LLM call fails, the original report is used and
  // the user is never blocked.
  try {
    think(job, "synthesizing", "Running constitutional self-critique pass — annotating claims with [verified] / [unverified] / [contradicted] markers...");
    const annotated = await selfCritiquePass(finalReport, job.sources, llm, config);
    if (annotated !== finalReport) {
      // The function returned a different string → annotation happened.
      const markers = (annotated.match(/\[(?:verified|unverified|contradicted)\]/g) || []).length;
      log(job, "success", "synthesizing", `Self-critique pass annotated ${markers} claim${markers === 1 ? "" : "s"} with verification markers.`);
      think(job, "synthesizing",
        `Self-critique complete — ${markers} claim${markers === 1 ? " was" : "s were"} annotated with [verified] / [unverified] / [contradicted] markers based on the cited sources.`,
        "Hover any [N] citation in the report to inspect the source's verification status."
      );
      finalReport = annotated;
    } else {
      // Either the report was too short, no sources, or the LLM output
      // failed the length-ratio/marker-count guards. Silently fall back.
      log(job, "info", "synthesizing", "Self-critique pass skipped (report too short, no sources, or LLM output failed guards).");
    }
  } catch (err) {
    // Non-fatal: keep the original report. The user is never blocked by
    // a critique error.
    Sentry.captureException(err);
    log(job, "warn", "synthesizing", `Self-critique pass failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return appendBiasDisclaimer(finalReport);
}
