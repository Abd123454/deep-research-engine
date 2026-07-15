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

/** Extract code blocks from LLM output. */
function extractCode(text: string, language: string): string {
  // Look for ```language\n...\n``` or ```\n...\n```
  const langPattern = language === "python" ? "python" : "javascript|js";
  const codeBlockRegex = new RegExp("```(?:" + langPattern + ")?\n([\\s\\S]*?)```", "i");
  const match = text.match(codeBlockRegex);
  if (match && match[1]) return match[1].trim();

  // Fallback: if no code block, check if the whole text looks like code.
  // (Heuristic: contains function/def keyword)
  if (/^(function |def |const |class )/m.test(text.trim())) {
    return text.trim();
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
      await runResearch(job.id);
      await waitForJobCompletion(job.id, 180_000); // 3 min timeout

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
    console.log(`[eval] Running ${query.id} (${query.type}/${query.difficulty}): ${query.query.slice(0, 60)}...`);
    const result = await runEval(query);
    results.push(result);
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`[eval] ${query.id}: ${status} (${result.score}%) ${result.details.error ? "— " + result.details.error.slice(0, 80) : ""}`);
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
