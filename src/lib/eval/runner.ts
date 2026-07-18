// Evaluation runner — executes eval queries and reports pass/fail metrics.
//
// For research queries: starts a research job, waits for completion, checks
// that expected sources are cited and expected keywords appear in the report.
//
// For coding queries: runs the swarm (coder agent), extracts code from the
// output, appends the test, and executes it in the sandbox.
//
// For factual queries: calls the quick chat LLM and checks for keywords.

import { EVAL_DATASET, type EvalQuery } from "./dataset";
import { createJob, getJob } from "../research-store";
import { runResearch } from "../research-engine";
import { runSwarm } from "../swarm";
import { runCode } from "../code-sandbox";
import { getLLM, type LLMMessage } from "../llm-provider";
import { logger } from "../logger";

export interface EvalResult {
  queryId: string;
  query: string;
  type: string;
  passed: boolean;
  score: number; // 0-100
  details: {
    sourcesFound?: boolean;
    keywordsPresent?: boolean;
    codeTestPassed?: boolean;
    responseTimeMs: number;
    tokensUsed: number;
    error?: string;
  };
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  avgScore: number;
  avgTimeMs: number;
  totalTokens: number;
  byType: Record<string, { passed: number; total: number; avgScore: number }>;
}

export interface EvalSuiteResult {
  results: EvalResult[];
  summary: EvalSummary;
}

// ---------- Helpers ----------

/** Wait for a research job to complete (or timeout). */
async function waitForJobCompletion(jobId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === "completed" || job.status === "failed") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

/** Extract code blocks from LLM output.
 *
 * The swarm (and especially the synthesizer) often emits a fenced code
 * block with the requested function. But it can also:
 *   - emit MULTIPLE code blocks (one with an example, one with the actual
 *     solution) — we want the longest one (the real solution);
 *   - emit the function with NO fences, inline in prose — we recover it via
 *     a function/def declaration heuristic;
 *   - emit the function with a ```` ```ts ```` fence even when we asked for
 *     javascript — accept ts/py/js as aliases.
 *
 * Returns the trimmed code on success, or "" if no plausible code block
 * was found.
 */
function extractCode(text: string, language: string): string {
  if (!text) return "";

  // Accepted language aliases for the fence header.
  const langPattern = language === "python" ? "python|py" : "javascript|js|typescript|ts";
  const fenceRegex = new RegExp(
    "```(?:" + langPattern + ")?\\s*\\n([\\s\\S]*?)```",
    "ig"
  );

  // Find ALL fenced code blocks and pick the longest one. The longest
  // block is almost always the actual solution rather than a tiny example
  // or a one-liner. (Kimi-style: prefer the block with the most substance.)
  let bestBlock = "";
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    const block = (match[1] || "").trim();
    if (block.length > bestBlock.length) {
      bestBlock = block;
    }
  }
  if (bestBlock) {
    return bestBlock;
  }

  // Fallback 1: the swarm sometimes writes the function inline in prose,
  // with no fences. Try to extract from the first `function`/`def`/`const`/
  // `class` keyword to the end of the text, then trim trailing prose.
  // (Search ANYWHERE in the text, not just at line start — the model may
  // prefix the declaration with "Here's the function:" or similar.)
  const declRegex = language === "python"
    ? /\b(def |class |async def )/
    : /\b(function |const |let |var |class |async function )/;
  const declMatch = text.match(declRegex);
  if (declMatch && declMatch.index !== undefined) {
    const candidate = text.slice(declMatch.index).trim();
    // Strip a trailing ``` fence if the model opened one but never closed
    // it, and any obvious trailing prose (lines that don't look like code).
    const cleaned = candidate
      .replace(/```[a-z]*\s*$/i, "")
      .replace(/\n```$/g, "")
      .trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  // Fallback 2: if the whole text looks like code (starts with a declaration),
  // return it as-is.
  const trimmed = text.trim();
  if (/^(function |def |const |let |var |class |async function )/m.test(trimmed)) {
    return trimmed;
  }

  return "";
}

/** Quick chat LLM call (non-streaming) for factual queries. */
async function runQuickChat(query: string): Promise<{ content: string; tokensUsed: number }> {
  const llm = await getLLM();
  const messages: LLMMessage[] = [
    { role: "system", content: "Answer the question concisely. Be accurate." },
    { role: "user", content: query },
  ];
  const result = await llm.fast({ messages, maxTokens: 200, temperature: 0.3 });
  return { content: result.content, tokensUsed: result.tokensUsed || 0 };
}

// ---------- Single query evaluation ----------

export async function runEval(query: EvalQuery): Promise<EvalResult> {
  const startTime = Date.now();

  try {
    // ===== Research =====
    if (query.type === "research") {
      // Rate-limit spacing: NVIDIA free-tier allows 40 req/min.
      // Each research query makes ~15-20 LLM calls. Add 2s delay between
      // queries so successive eval runs do not trip the 429 wall.
      await new Promise((r) => setTimeout(r, 2000));

      const config = {
        query: query.query,
        depth: "standard" as const,
        numSubQueries: 3,
        maxLinksPerQuery: 5,
        pageReadConcurrency: 3,
        reportMaxTokens: 2000,
        retriever: "duckduckgo" as const,
        llmProvider: "nvidia" as const,
        enableMultiRound: false,
        numGapQueries: 2,
      };

      const job = createJob(query.query, config);

      // Wrap runResearch in an exponential-backoff retry loop for 429s.
      // The LLM provider already retries individual calls, but a sustained
      // rate-limit storm (entire pipeline trips 429) needs a longer cool-off.
      let lastResearchErr: unknown;
      const maxResearchAttempts = 3;
      for (let attempt = 0; attempt < maxResearchAttempts; attempt++) {
        try {
          await runResearch(job.id);
          break;
        } catch (err) {
          lastResearchErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const is429 = /429|rate.?limit|too many requests/i.test(msg);
          if (!is429 || attempt === maxResearchAttempts - 1) {
            throw err;
          }
          // Exponential backoff: 4s, 8s.
          const backoffMs = 4_000 * Math.pow(2, attempt);
          logger.warn(
            { module: "eval", queryId: query.id, attempt: attempt + 1, backoffMs, err: msg.slice(0, 120) },
            "Research pipeline hit 429 — backing off before retry"
          );
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
      // If we exhausted retries without breaking, surface the last error.
      if (lastResearchErr) {
        // unreachable — the loop above either breaks or throws — but TS
        // cannot infer that, so guard explicitly.
        throw lastResearchErr;
      }

      try {
        await waitForJobCompletion(job.id, 180_000); // 3 min timeout
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // If the job itself tripped a 429 internally, give it one more
        // shot at waiting (the job may still complete on its own).
        if (/429|rate.?limit|too many requests/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 4_000));
          await waitForJobCompletion(job.id, 60_000);
        } else {
          throw err;
        }
      }

      const finalJob = getJob(job.id);
      if (!finalJob) throw new Error("Job disappeared");

      const sourcesFound = query.expectedSources
        ? query.expectedSources.every((url) =>
            finalJob.sources.some((s) => s.url.includes(url))
          )
        : true;

      const reportText = (finalJob.report || "").toLowerCase();
      const keywordsPresent = query.expectedKeywords
        ? query.expectedKeywords.every((kw) => reportText.includes(kw.toLowerCase()))
        : true;

      const score = (sourcesFound ? 50 : 0) + (keywordsPresent ? 50 : 0);

      return {
        queryId: query.id,
        query: query.query,
        type: query.type,
        passed: sourcesFound && keywordsPresent,
        score,
        details: {
          sourcesFound,
          keywordsPresent,
          responseTimeMs: Date.now() - startTime,
          tokensUsed: finalJob.stats.totalTokensUsed,
          error: finalJob.error || undefined,
        },
      };
    }

    // ===== Coding =====
    if (query.type === "coding" && query.codingTest) {
      const events: { type: string; finalReport?: string }[] = [];
      const { finalReport } = await runSwarm(query.query, (e) => {
        events.push(e as { type: string; finalReport?: string });
      });

      const code = extractCode(finalReport, query.codingTest.language);
      if (!code) {
        return {
          queryId: query.id,
          query: query.query,
          type: query.type,
          passed: false,
          score: 0,
          details: {
            codeTestPassed: false,
            responseTimeMs: Date.now() - startTime,
            tokensUsed: 0,
            error: "No code block found in swarm output",
          },
        };
      }

      // Execute code + test together.
      const fullCode = code + "\n" + query.codingTest.test;
      const result = await runCode(query.codingTest.language, fullCode);

      return {
        queryId: query.id,
        query: query.query,
        type: query.type,
        passed: result.success,
        score: result.success ? 100 : 0,
        details: {
          codeTestPassed: result.success,
          responseTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          error: result.success ? undefined : result.error,
        },
      };
    }

    // ===== Factual =====
    if (query.type === "factual") {
      const { content, tokensUsed } = await runQuickChat(query.query);
      const lowerContent = content.toLowerCase();
      const keywordsPresent = query.expectedKeywords
        ? query.expectedKeywords.every((kw) => lowerContent.includes(kw.toLowerCase()))
        : true;

      return {
        queryId: query.id,
        query: query.query,
        type: query.type,
        passed: keywordsPresent,
        score: keywordsPresent ? 100 : 0,
        details: {
          keywordsPresent,
          responseTimeMs: Date.now() - startTime,
          tokensUsed,
        },
      };
    }

    throw new Error(`Unknown query type: ${query.type}`);
  } catch (err) {
    return {
      queryId: query.id,
      query: query.query,
      type: query.type,
      passed: false,
      score: 0,
      details: {
        responseTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        error: err instanceof Error ? err.message : "Eval failed",
      },
    };
  }
}

// ---------- Full suite ----------

export async function runEvalSuite(options?: {
  queries?: string[]; // optional: run only these query IDs
}): Promise<EvalSuiteResult> {
  const queries = options?.queries
    ? EVAL_DATASET.filter((q) => options.queries!.includes(q.id))
    : EVAL_DATASET;

  const results: EvalResult[] = [];

  for (const query of queries) {
    logger.info(
      {
        module: "eval",
        queryId: query.id,
        type: query.type,
        difficulty: query.difficulty,
        query: query.query.slice(0, 60),
      },
      "Running eval query"
    );
    const result = await runEval(query);
    results.push(result);
    const status = result.passed ? "PASS" : "FAIL";
    logger.info(
      {
        module: "eval",
        queryId: query.id,
        status,
        score: result.score,
        error: result.details.error ? result.details.error.slice(0, 80) : undefined,
      },
      "Eval query finished"
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const avgTimeMs = results.length > 0 ? results.reduce((s, r) => s + r.details.responseTimeMs, 0) / results.length : 0;
  const totalTokens = results.reduce((s, r) => s + r.details.tokensUsed, 0);

  const byType: Record<string, { passed: number; total: number; avgScore: number }> = {};
  for (const r of results) {
    if (!byType[r.type]) byType[r.type] = { passed: 0, total: 0, avgScore: 0 };
    byType[r.type].total++;
    if (r.passed) byType[r.type].passed++;
    byType[r.type].avgScore += r.score;
  }
  for (const t of Object.keys(byType)) {
    byType[t].avgScore = byType[t].total > 0 ? byType[t].avgScore / byType[t].total : 0;
  }

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      avgScore: Math.round(avgScore),
      avgTimeMs: Math.round(avgTimeMs),
      totalTokens,
      byType,
    },
  };
}
