// Deep Research Engine
//
// Pipeline:
//   1. Decompose the user's query into N sub-questions (FAST_LLM).
//   2. For each sub-question:
//      a. web_search -> list of URLs.
//      b. page_reader -> read up to MAX_LINKS_PER_QUERY pages (bounded concurrency).
//      c. Extract key findings from each page (SMART_LLM, batched).
//   3. Synthesize a comprehensive long-form report with citations (SMART_LLM).

import { getLLM, type LLMMessage } from "./llm-provider";
import { searchWeb } from "./retriever";
import { readPages } from "./page-reader";
import { getRetriever } from "./retriever";
import { getJob } from "./research-store";
import { randomUUID } from "crypto";
import type {
  ResearchConfig,
  ResearchJob,
  ResearchStatus,
  SubQuery,
  LogEntry,
  Source,
  SearchResultItem,
  PageReadResult,
} from "./types";

function envInt(key: string, fallback: number, min = 1, max = 1000): number {
  if (typeof process === "undefined") return fallback;
  const raw = process.env?.[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function envStr(key: string, fallback: string): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim() || fallback;
}

export function resolveConfig(
  query: string,
  overrides?: Partial<ResearchConfig>
): ResearchConfig {
  const depth = (overrides?.depth ||
    (envStr("SEARCH_DEPTH", "advanced") as ResearchConfig["depth"])) as ResearchConfig["depth"];

  const depthPresets: Record<
    ResearchConfig["depth"],
    { numSubQueries: number; maxLinksPerQuery: number }
  > = {
    standard: { numSubQueries: 4, maxLinksPerQuery: 5 },
    deep: { numSubQueries: 6, maxLinksPerQuery: 10 },
    advanced: {
      numSubQueries: envInt("NUM_SUB_QUERIES", 8, 2, 15),
      maxLinksPerQuery: envInt("MAX_LINKS_PER_QUERY", 25, 3, 30),
    },
  };

  const preset = depthPresets[depth];

  return {
    query,
    depth,
    numSubQueries: overrides?.numSubQueries ?? preset.numSubQueries,
    maxLinksPerQuery: overrides?.maxLinksPerQuery ?? preset.maxLinksPerQuery,
    pageReadConcurrency:
      overrides?.pageReadConcurrency ??
      envInt("PAGE_READ_CONCURRENCY", 4, 1, 8),
    reportMaxTokens:
      overrides?.reportMaxTokens ?? envInt("REPORT_MAX_TOKENS", 8000, 1000, 32000),
    retriever: overrides?.retriever ?? getRetriever(),
    llmProvider:
      overrides?.llmProvider ??
      (envStr("LLM_PROVIDER", "zai") as ResearchConfig["llmProvider"]),
  };
}

// ---------- Job mutation helpers ----------

function log(
  job: ResearchJob,
  level: LogEntry["level"],
  stage: ResearchStatus,
  message: string
) {
  const entry: LogEntry = { ts: Date.now(), level, stage, message };
  job.logs.push(entry);
  if (job.logs.length > 500) job.logs.splice(0, job.logs.length - 500);
  job.updatedAt = Date.now();
}

function setStatus(job: ResearchJob, status: ResearchStatus) {
  job.status = status;
  job.updatedAt = Date.now();
  if (status === "completed" || status === "failed") {
    job.finishedAt = Date.now();
    if (job.startedAt) {
      job.stats.elapsedMs = job.finishedAt - job.startedAt;
    }
  }
}

// ---------- Stage 1: Decomposition ----------

// Max length of a single sub-question (in chars). Web search engines have
// URL length limits (~4094 chars), and very long queries also dilute
// relevance. We keep sub-questions focused and web-search-friendly.
const MAX_SUBQUESTION_CHARS = 280;

function truncateQuestion(q: string): string {
  const trimmed = q.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_SUBQUESTION_CHARS) return trimmed;
  // Try to cut at the last sentence boundary within the limit.
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

// Robust JSON extraction from LLM output (handles code fences, preamble, etc.).
function extractQuestionsJson(text: string): string[] {
  if (!text) return [];
  // 1) Try direct parse.
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.questions)) return parsed.questions.map(String);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* fall through */
  }
  // 2) Try to find a JSON object/array inside the text.
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
  // 3) Markdown code fence extraction.
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
  // 4) Plain-text fallback: lines ending with "?" or numbered items.
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[\.\)]|-|\*|\+)\s*/, "").trim())
    .filter((l) => l.length > 8 && l.length < 600);
  const questions = lines.filter((l) => l.endsWith("?"));
  if (questions.length > 0) return questions;
  // 5) If we have at least 2 numbered short lines, use them.
  if (lines.length >= 2) return lines;
  return [];
}

// Heuristic fallback: when the LLM fails entirely, slice the giant prompt
// into topical chunks based on markdown headings or paragraph boundaries.
function heuristicDecompose(query: string, numSubQueries: number): string[] {
  // Try to split by markdown numbered headings (e.g., "1. ", "2. ").
  const headingSplit = query.split(/\n\s*(?:\d+[\.\)]\s+|#{1,6}\s+)/);
  if (headingSplit.length >= 2) {
    return headingSplit
      .map((s) => truncateQuestion(s.replace(/\n+/g, " ").trim()))
      .filter((s) => s.length > 20)
      .slice(0, numSubQueries);
  }
  // Fallback: split by double newlines (paragraphs).
  const paraSplit = query.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
  if (paraSplit.length >= 2) {
    return paraSplit
      .map((p) => truncateQuestion(p.replace(/\n+/g, " ").trim()))
      .filter((s) => s.length > 20)
      .slice(0, numSubQueries);
  }
  // Last resort: the whole query, truncated to be search-friendly.
  return [truncateQuestion(query)];
}

async function decompose(
  job: ResearchJob,
  config: ResearchConfig
): Promise<string[]> {
  setStatus(job, "decomposing");
  log(job, "info", "decomposing", `Decomposing query into ${config.numSubQueries} sub-questions...`);

  const llm = await getLLM();

  // Detect if this is a "giant" prompt and adapt accordingly.
  const queryLen = config.query.length;
  const isGiant = queryLen > 4000;
  const isMega = queryLen > 15000;

  if (isGiant) {
    log(
      job,
      "info",
      "decomposing",
      `Large prompt detected (${queryLen.toLocaleString()} chars). Using enhanced decomposition strategy.`
    );
  }
  if (isMega) {
    log(
      job,
      "info",
      "decomposing",
      `Mega prompt detected. Allocating extra token budget for thorough decomposition.`
    );
  }

  const sys: LLMMessage = {
    role: "system",
    content:
      "You are a senior research strategist and domain expert. Your task is to break a complex research query into a set of focused, diverse, and non-redundant sub-questions that together will fully cover the topic. Each sub-question should be specific enough to be answerable via web search, and collectively they should explore different facets: definitions, mechanisms, evidence, comparisons, recent developments, controversies, and practical implications.\n\nWhen the user provides a long, detailed research brief, treat it as a rich source of context: identify every distinct topic, requirement, angle, and constraint it mentions, and ensure your sub-questions collectively cover ALL of them. Do not collapse multiple distinct topics into one question. Prefer more specific sub-questions over vague ones.\n\nCRITICAL: Each sub-question MUST be a concise, self-contained web search query of at most 250 characters. Do NOT paste long briefs into the sub-questions. Distill each topic to its essence.",
  };
  const user: LLMMessage = {
    role: "user",
    content: `Research query / brief:
"""
${config.query}
"""

Generate exactly ${config.numSubQueries} sub-questions that, when researched thoroughly, will enable writing a comprehensive long-form report covering EVERY aspect mentioned in the brief above.

Rules for each sub-question:
- Must be a concise web search query (max 250 characters).
- Must be self-contained (no references to "the above" or "section 3").
- Must target a specific, searchable facet of the topic.

Return ONLY a JSON object with this exact shape (no markdown fences, no preamble, no commentary):
{"questions": ["...", "...", ...]}`,
  };

  // Scale the output token budget with prompt size so we don't truncate
  // the generated questions on mega prompts.
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
    rawQuestions = extractQuestionsJson(result.content);
    if (rawQuestions.length === 0) {
      llmError = `LLM returned no parseable questions. Raw output preview: ${result.content.slice(0, 200)}`;
    }
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
    log(job, "warn", "decomposing", `LLM decomposition call failed: ${llmError}`);
  }

  // Normalize + truncate every sub-question to keep it search-friendly.
  let questions = rawQuestions
    .map((q) => truncateQuestion(q))
    .filter((q) => q.length > 0)
    .slice(0, config.numSubQueries);

  // If the LLM gave us nothing usable, fall back to heuristic decomposition
  // of the original prompt. This guarantees the pipeline can still run.
  if (questions.length === 0) {
    log(
      job,
      "warn",
      "decomposing",
      `LLM decomposition yielded no usable questions. Falling back to heuristic decomposition.${llmError ? " (" + llmError + ")" : ""}`
    );
    questions = heuristicDecompose(config.query, config.numSubQueries);
  }

  // If we still only have 1 question but asked for more, expand via heuristics.
  if (questions.length < Math.min(3, config.numSubQueries)) {
    const extra = heuristicDecompose(config.query, config.numSubQueries);
    const seen = new Set(questions.map((q) => q.toLowerCase().slice(0, 60)));
    for (const q of extra) {
      const key = q.toLowerCase().slice(0, 60);
      if (!seen.has(key)) {
        questions.push(q);
        seen.add(key);
      }
      if (questions.length >= config.numSubQueries) break;
    }
  }

  // Final safety: ensure at least one question.
  if (questions.length === 0) {
    questions = [truncateQuestion(config.query) || config.query.slice(0, 280)];
  }

  // Initialize sub-query records.
  job.subQueries = questions.map((q) => ({
    id: randomUUID(),
    question: q,
    status: "pending",
    searchResults: [],
    pagesRead: 0,
    pagesSucceeded: 0,
    keyFindings: "",
  }));

  log(
    job,
    "success",
    "decomposing",
    `Generated ${job.subQueries.length} sub-questions.`
  );
  job.subQueries.forEach((sq, i) =>
    log(job, "info", "decomposing", `  Q${i + 1}. ${sq.question}`)
  );

  return questions;
}

// ---------- Stage 2 + 3 + 4 (per sub-query): search -> read -> extract ----------

function snippetFromPage(p: PageReadResult, max = 600): string {
  return p.text.slice(0, max).trim();
}

async function processSubQuery(
  job: ResearchJob,
  sq: SubQuery,
  config: ResearchConfig
): Promise<void> {
  sq.status = "searching";
  sq.startedAt = Date.now();

  // Defensive: ensure the search query is within a safe length for the
  // web_search API (which has URL length limits). 400 chars is well under
  // the ~4094-char HTTP request-line limit.
  const searchQuery =
    sq.question.length > 400 ? truncateQuestion(sq.question) : sq.question;
  if (searchQuery !== sq.question) {
    log(
      job,
      "warn",
      "searching",
      `Sub-question was truncated for web search: "${searchQuery}"`
    );
  }
  log(job, "info", "searching", `Searching: "${searchQuery}"`);

  // 2) Web search.
  let results: SearchResultItem[] = [];
  try {
    results = await searchWeb(searchQuery, config.maxLinksPerQuery, config.retriever);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sq.status = "failed";
    sq.error = msg;
    sq.finishedAt = Date.now();
    log(job, "error", "searching", `Search failed for "${searchQuery}": ${msg}`);
    return;
  }

  sq.searchResults = results;
  job.stats.totalPagesFound += results.length;
  log(
    job,
    "success",
    "searching",
    `Found ${results.length} results for: "${sq.question}"`
  );

  if (results.length === 0) {
    sq.status = "done";
    sq.finishedAt = Date.now();
    job.stats.subQueriesCompleted += 1;
    return;
  }

  // 3) Read pages.
  sq.status = "reading";
  setStatus(job, "reading");
  log(
    job,
    "info",
    "reading",
    `Reading up to ${results.length} pages for: "${sq.question}"`
  );

  const urls = results.slice(0, config.maxLinksPerQuery).map((r) => r.url);
  const pages = await readPages(urls, config.pageReadConcurrency);

  sq.pagesRead = pages.length;
  sq.pagesSucceeded = pages.filter((p) => p.success).length;
  job.stats.totalPagesRead += pages.length;
  job.stats.totalPagesSucceeded += sq.pagesSucceeded;
  job.stats.totalTokensUsed += pages.reduce((sum, p) => sum + (p.tokensUsed || 0), 0);

  // Collect sources.
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const r = results[i];
    job.sources.push({
      url: p.url,
      title: p.title || r?.name || p.url,
      host: r?.host_name || safeHost(p.url),
      snippet: r?.snippet || "",
      subQueryId: sq.id,
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
    `Read ${sq.pagesRead} pages (${sq.pagesSucceeded} with usable content) for: "${sq.question}"`
  );

  // 4) Extract key findings from successful pages (batched by LLM).
  sq.status = "extracting";
  setStatus(job, "extracting");
  log(job, "info", "extracting", `Extracting key findings for: "${sq.question}"`);

  const successfulPages = pages.filter((p) => p.success && p.text.length > 200);
  const findings = await extractFindings(sq.question, successfulPages);
  sq.keyFindings = findings;
  sq.status = "done";
  sq.finishedAt = Date.now();
  job.stats.subQueriesCompleted += 1;

  log(
    job,
    "success",
    "extracting",
    `Findings extracted for: "${sq.question}" (${findings.length} chars)`
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function extractFindings(
  question: string,
  pages: PageReadResult[]
): Promise<string> {
  if (pages.length === 0) return "";

  const llm = await getLLM();

  // Batch pages into chunks to fit context windows. Aim for ~8K chars per batch.
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

  const batchFindings: string[] = [];
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const context = batch
      .map((p, i) => {
        const snippet = p.text.slice(0, 3500).trim();
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
        maxTokens: 1500,
        temperature: 0.2,
      });
      batchFindings.push(result.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      batchFindings.push(`_(Extraction failed for batch ${bi + 1}: ${msg})_`);
    }
  }

  return batchFindings.join("\n\n");
}

// ---------- Stage 5: Synthesis (final comprehensive report) ----------

async function synthesizeReport(
  job: ResearchJob,
  config: ResearchConfig
): Promise<string> {
  setStatus(job, "synthesizing");
  log(job, "info", "synthesizing", "Writing the comprehensive final report...");

  const llm = await getLLM();

  // Build the "research dossier" with all findings + a source index.
  const findingsBlock = job.subQueries
    .map((sq, i) => {
      const findings = sq.keyFindings || "_(no findings extracted)_";
      return `## Sub-question ${i + 1}: ${sq.question}\n\n${findings}`;
    })
    .join("\n\n---\n\n");

  const sourcesBlock = job.sources
    .filter((s) => s.excerpt)
    .map((s, i) => {
      const date = s.publishedTime ? ` (${s.publishedTime.slice(0, 10)})` : "";
      return `[${i + 1}] ${s.title}${date} — ${s.host}\n    ${s.url}`;
    })
    .join("\n");

  const sys: LLMMessage = {
    role: "system",
    content: `You are an elite research analyst and long-form writer, comparable to a senior journalist at a top-tier publication combined with a domain expert. You synthesize raw research notes into comprehensive, well-structured, deeply informative reports.

Your report MUST:
- Be written in clear, professional prose (use the SAME language as the user's query).
- Be long-form and comprehensive (this is a "Deep Research" report — aim for depth, not brevity).
- Use Markdown with a clear hierarchy: # H1 title, ## section headings, ### subsections.
- Open with a concise executive summary (TL;DR) as a dedicated section.
- Cover all major facets discovered across the sub-questions.
- Include specific facts, numbers, dates, and named entities from the sources.
- Cite sources inline using markdown link syntax: [text](url) — only use URLs that appear in the provided source list.
- Include a "## Sources" section at the end listing all cited URLs.
- Acknowledge uncertainty or conflicting evidence where present.
- Avoid filler, fluff, and repetition. Every paragraph should add information.

Do NOT fabricate sources or URLs. Only cite URLs that appear in the provided source list.`,
  };

  const user: LLMMessage = {
    role: "user",
    content: `# Original Research Query
${config.query}

# Research Configuration
- Depth: ${config.depth}
- Sub-questions explored: ${job.subQueries.length}
- Pages read: ${job.stats.totalPagesRead} (${job.stats.totalPagesSucceeded} with usable content)
- Tokens used (page reading): ${job.stats.totalTokensUsed}

# Extracted Findings (per sub-question)
${findingsBlock}

# Source Index (cite only these URLs)
${sourcesBlock || "_(no sources available)_"}

# Task
Write a comprehensive long-form Deep Research report answering the original query, synthesizing ALL the findings above. Target length: roughly ${config.reportMaxTokens} tokens. Use Markdown. Include an executive summary, multiple thematic sections, and inline citations to the source URLs. End with a "## Sources" section.`,
  };

  const result = await llm.smart({
    messages: [sys, user],
    maxTokens: config.reportMaxTokens,
    temperature: 0.4,
  });

  log(
    job,
    "success",
    "synthesizing",
    `Report written (${result.content.length} chars).`
  );
  return result.content;
}

// ---------- Orchestrator ----------

export async function runResearch(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  job.startedAt = Date.now();
  job.updatedAt = Date.now();

  try {
    // Stage 1: decompose.
    await decompose(job, job.config);

    // Stages 2-4: process each sub-query.
    // We process them sequentially to keep page-reader concurrency bounded
    // and to give clean, ordered progress logs. This is also friendlier to
    // rate limits on the underlying Z.AI / NVIDIA APIs.
    for (let i = 0; i < job.subQueries.length; i++) {
      const sq = job.subQueries[i];
      log(
        job,
        "info",
        "searching",
        `Processing sub-question ${i + 1}/${job.subQueries.length}: "${sq.question}"`
      );
      try {
        await processSubQuery(job, sq, job.config);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sq.status = "failed";
        sq.error = msg;
        sq.finishedAt = Date.now();
        log(job, "error", "searching", `Sub-query failed: "${sq.question}" — ${msg}`);
      }
    }

    // Stage 5: synthesize final report.
    job.report = await synthesizeReport(job, job.config);

    setStatus(job, "completed");
    log(
      job,
      "success",
      "completed",
      `Deep research completed in ${Math.round(
        (Date.now() - (job.startedAt || Date.now())) / 1000
      )}s. Read ${job.stats.totalPagesRead} pages across ${job.subQueries.length} sub-queries.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.error = msg;
    setStatus(job, "failed");
    log(job, "error", "failed", `Research failed: ${msg}`);
  }
}
