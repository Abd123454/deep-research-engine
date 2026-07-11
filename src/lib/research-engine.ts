// Deep Research Engine
//
// Multi-stage pipeline designed to surpass single-round deep research tools:
//
//   1. PLAN       — Generate a structured research outline (Gemini-style).
//   2. DECOMPOSE  — Break the query into focused sub-questions.
//   3. ROUND 1    — For each sub-question: search → read → extract findings.
//   4. GAP ANALYSIS — Review round-1 findings, identify what's missing.
//   5. ROUND 2    — Generate + process gap-filling sub-questions.
//   6. SYNTHESIZE — Write the final long-form report following the plan.
//
// The multi-round gap-filling is the key differentiator vs. ChatGPT/Grok/
// Perplexity single-pass research.

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
  ResearchPlan,
  PlanSection,
  SubQuery,
  LogEntry,
  Source,
  SearchResultItem,
  PageReadResult,
  SubQueryRound,
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

function envBool(key: string, fallback: boolean): boolean {
  if (typeof process === "undefined") return fallback;
  const raw = process.env?.[key];
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export function resolveConfig(
  query: string,
  overrides?: Partial<ResearchConfig>
): ResearchConfig {
  const depth = (overrides?.depth ||
    (envStr("SEARCH_DEPTH", "advanced") as ResearchConfig["depth"])) as ResearchConfig["depth"];

  const depthPresets: Record<
    ResearchConfig["depth"],
    {
      numSubQueries: number;
      maxLinksPerQuery: number;
      numGapQueries: number;
      enableMultiRound: boolean;
    }
  > = {
    standard: {
      numSubQueries: 4,
      maxLinksPerQuery: 5,
      numGapQueries: 2,
      enableMultiRound: false,
    },
    deep: {
      numSubQueries: 6,
      maxLinksPerQuery: 10,
      numGapQueries: 3,
      enableMultiRound: true,
    },
    advanced: {
      numSubQueries: envInt("NUM_SUB_QUERIES", 8, 2, 15),
      maxLinksPerQuery: envInt("MAX_LINKS_PER_QUERY", 25, 3, 30),
      numGapQueries: envInt("NUM_GAP_QUERIES", 4, 1, 8),
      enableMultiRound: true,
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
    enableMultiRound:
      overrides?.enableMultiRound ?? preset.enableMultiRound,
    numGapQueries: overrides?.numGapQueries ?? preset.numGapQueries,
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
  if (job.logs.length > 800) job.logs.splice(0, job.logs.length - 800);
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

// ---------- Question utilities ----------

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

function heuristicDecompose(query: string, numSubQueries: number): string[] {
  const headingSplit = query.split(/\n\s*(?:\d+[\.\)]\s+|#{1,6}\s+)/);
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

// ---------- Stage 1: Planning (Gemini-style research outline) ----------

async function generatePlan(
  job: ResearchJob,
  config: ResearchConfig
): Promise<ResearchPlan> {
  setStatus(job, "planning");
  log(job, "info", "planning", "Creating a research plan...");

  const llm = await getLLM();
  const queryLen = config.query.length;
  const isGiant = queryLen > 4000;

  const sys: LLMMessage = {
    role: "system",
    content:
      "You are a senior research director. Given a research query, you produce a clear, well-structured research plan: a working title, a one-paragraph summary of what the report will cover, and a list of thematic sections (each with a title and a one-sentence description). The sections should collectively cover the topic exhaustively and flow logically. For long briefs, ensure every distinct topic mentioned is represented as a section.",
  };
  const user: LLMMessage = {
    role: "user",
    content: `Research query / brief:
"""
${config.query}
"""

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

  let plan: ResearchPlan = {
    title: "Deep Research Report",
    summary: "",
    sections: [],
  };

  try {
    const result = await llm.smart({
      messages: [sys, user],
      maxTokens: isGiant ? 2500 : 1800,
      temperature: 0.4,
      json: true,
    });

    // Try to parse the plan JSON.
    const parsed = tryParsePlan(result.content);
    if (parsed) plan = parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(job, "warn", "planning", `Plan generation failed: ${msg}`);
  }

  // Fallback: if no sections, derive them heuristically.
  if (plan.sections.length === 0) {
    plan.title = plan.title || "Deep Research Report";
    plan.sections = deriveFallbackSections(config.query);
  }

  job.plan = plan;
  log(job, "success", "planning", `Research plan ready: "${plan.title}" (${plan.sections.length} sections)`);
  plan.sections.forEach((s, i) =>
    log(job, "info", "planning", `  ${i + 1}. ${s.title}`)
  );

  return plan;
}

function tryParsePlan(text: string): ResearchPlan | null {
  const candidates: string[] = [];
  try {
    candidates.push(text);
  } catch {
    /* noop */
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
    } catch {
      /* try next */
    }
  }
  return null;
}

function deriveFallbackSections(query: string): PlanSection[] {
  const headingSplit = query
    .split(/\n\s*(?:\d+[\.\)]\s+|#{1,6}\s+)/)
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

// ---------- Stage 2: Decomposition ----------

async function decompose(
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
      "You are a senior research strategist and domain expert. Your task is to break a complex research query into focused, diverse, non-redundant sub-questions that together will fully cover the topic. Each sub-question must be specific enough to be answerable via web search.\n\nCRITICAL: Each sub-question MUST be a concise, self-contained web search query of at most 250 characters. Do NOT paste long briefs into the sub-questions. Distill each topic to its essence.",
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

// ---------- Stages 3-5 (per sub-query): search -> read -> extract ----------

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

  const searchQuery =
    sq.question.length > 400 ? truncateQuestion(sq.question) : sq.question;
  if (searchQuery !== sq.question) {
    log(job, "warn", "searching", `Sub-question truncated for web search: "${searchQuery}"`);
  }
  const roundTag = sq.round === 2 ? "[R2] " : "";
  log(job, "info", "searching", `Searching ${roundTag}"${searchQuery}"`);

  let results: SearchResultItem[] = [];
  try {
    results = await searchWeb(searchQuery, config.maxLinksPerQuery, config.retriever);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sq.status = "failed";
    sq.error = msg;
    sq.finishedAt = Date.now();
    log(job, "error", "searching", `Search failed ${roundTag}"${searchQuery}": ${msg}`);
    return;
  }

  sq.searchResults = results;
  job.stats.totalPagesFound += results.length;
  log(job, "success", "searching", `Found ${results.length} results ${roundTag}for: "${sq.question}"`);

  if (results.length === 0) {
    sq.status = "done";
    sq.finishedAt = Date.now();
    job.stats.subQueriesCompleted += 1;
    return;
  }

  sq.status = "reading";
  setStatus(job, "reading");
  log(job, "info", "reading", `Reading up to ${results.length} pages ${roundTag}for: "${sq.question}"`);

  const urls = results.slice(0, config.maxLinksPerQuery).map((r) => r.url);
  const pages = await readPages(urls, config.pageReadConcurrency);

  sq.pagesRead = pages.length;
  sq.pagesSucceeded = pages.filter((p) => p.success).length;
  job.stats.totalPagesRead += pages.length;
  job.stats.totalPagesSucceeded += sq.pagesSucceeded;
  job.stats.totalTokensUsed += pages.reduce((sum, p) => sum + (p.tokensUsed || 0), 0);

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const r = results[i];
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
  const findings = await extractFindings(sq.question, successfulPages);
  sq.keyFindings = findings;
  sq.status = "done";
  sq.finishedAt = Date.now();
  job.stats.subQueriesCompleted += 1;

  log(job, "success", "extracting", `Findings extracted ${roundTag}for: "${sq.question}" (${findings.length} chars)`);
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

// ---------- Stage 4: Gap Analysis (the key differentiator) ----------

async function analyzeGaps(
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

    // Try to parse JSON.
    try {
      const parsed = JSON.parse(result.content);
      if (typeof parsed.gaps === "string") gapAnalysis = parsed.gaps;
      if (Array.isArray(parsed.follow_ups)) {
        followUps = parsed.follow_ups.map(String).map((q) => truncateQuestion(q)).filter((q) => q.length > 0);
      }
    } catch {
      // Fallback: use the raw text as the gap analysis.
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

  // Store the follow-ups on the job so round 2 can use them.
  (job as ResearchJob & { _followUps?: string[] })._followUps = followUps;
  return gapAnalysis;
}

// ---------- Stage 6: Synthesis ----------

async function synthesizeReport(
  job: ResearchJob,
  config: ResearchConfig
): Promise<string> {
  setStatus(job, "synthesizing");
  log(job, "info", "synthesizing", "Writing the comprehensive final report...");

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

Do NOT fabricate sources or URLs. Only cite URLs that appear in the provided source list.`,
  };

  const user: LLMMessage = {
    role: "user",
    content: `# Original Research Query
${config.query}

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

  const result = await llm.smart({
    messages: [sys, user],
    maxTokens: config.reportMaxTokens,
    temperature: 0.4,
  });

  log(job, "success", "synthesizing", `Report written (${result.content.length} chars).`);
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
    // Stage 1: Plan.
    await generatePlan(job, job.config);

    // Stage 2: Decompose (round 1).
    const round1SubQueries = await decompose(job, job.config, 1, job.config.numSubQueries);

    // Stages 3-5: Process each round-1 sub-query.
    for (let i = 0; i < round1SubQueries.length; i++) {
      const sq = round1SubQueries[i];
      log(
        job,
        "info",
        "searching",
        `Round 1 — processing sub-question ${i + 1}/${round1SubQueries.length}: "${sq.question}"`
      );
      try {
        await processSubQuery(job, sq, job.config);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sq.status = "failed";
        sq.error = msg;
        sq.finishedAt = Date.now();
        log(job, "error", "searching", `Sub-question failed: "${sq.question}" — ${msg}`);
      }
    }
    job.stats.roundsCompleted = 1;

    // Stage 4 + 5: Gap analysis + Round 2 (only if multi-round is enabled).
    if (job.config.enableMultiRound && job.config.numGapQueries > 0) {
      try {
        await analyzeGaps(job, job.config);

        const followUps = (job as ResearchJob & { _followUps?: string[] })._followUps || [];
        if (followUps.length > 0) {
          const round2Count = Math.min(followUps.length, job.config.numGapQueries);
          const round2Questions = followUps.slice(0, round2Count);

          // Create round-2 sub-queries directly from the follow-ups.
          const round2SubQueries: SubQuery[] = round2Questions.map((q) => ({
            id: randomUUID(),
            question: q,
            status: "pending",
            round: 2,
            rationale: "Gap-fill from round-1 analysis",
            searchResults: [],
            pagesRead: 0,
            pagesSucceeded: 0,
            keyFindings: "",
          }));
          job.subQueries.push(...round2SubQueries);

          log(job, "success", "decomposing", `Generated ${round2SubQueries.length} gap-filling sub-questions (Round 2).`);
          round2SubQueries.forEach((sq, i) =>
            log(job, "info", "decomposing", `  Q${i + 1} [R2]. ${sq.question}`)
          );

          // Process round-2 sub-queries.
          for (let i = 0; i < round2SubQueries.length; i++) {
            const sq = round2SubQueries[i];
            log(
              job,
              "info",
              "searching",
              `Round 2 — processing gap-fill ${i + 1}/${round2SubQueries.length}: "${sq.question}"`
            );
            try {
              await processSubQuery(job, sq, job.config);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              sq.status = "failed";
              sq.error = msg;
              sq.finishedAt = Date.now();
              log(job, "error", "searching", `Gap-fill failed: "${sq.question}" — ${msg}`);
            }
          }
          job.stats.roundsCompleted = 2;
        } else {
          log(job, "info", "analyzing_gaps", "No follow-up questions generated; skipping round 2.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(job, "warn", "analyzing_gaps", `Multi-round phase skipped due to error: ${msg}`);
      }
    }

    // Stage 6: Synthesize final report.
    job.report = await synthesizeReport(job, job.config);

    setStatus(job, "completed");
    log(
      job,
      "success",
      "completed",
      `Deep research completed in ${Math.round(
        (Date.now() - (job.startedAt || Date.now())) / 1000
      )}s across ${job.stats.roundsCompleted} round(s). Read ${job.stats.totalPagesRead} pages from ${job.subQueries.length} sub-questions.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.error = msg;
    setStatus(job, "failed");
    log(job, "error", "failed", `Research failed: ${msg}`);
  }
}
