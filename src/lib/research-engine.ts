// Quaesitor — Deep Research Pipeline :: ORCHESTRATOR
//
// Multi-stage pipeline designed to surpass single-round deep research tools:
//
//   1. PLAN       — structured outline
//   2. DECOMPOSE  — Break the query into focused sub-questions.
//   3. ROUND 1    — For each sub-question: search → read → extract findings.
//   4. GAP ANALYSIS — Review round-1 findings, identify what's missing.
//   5. ROUND 2    — Generate + process gap-filling sub-questions.
//   6. SYNTHESIZE — Write the final long-form report following the plan.
//
// The multi-round gap-filling is the key differentiator vs. ChatGPT/Grok/
// Perplexity single-pass research.
//
// ─── REFACTOR (reach-10 task) ─────────────────────────────────────
// The 6 stage functions + shared mutation helpers (log / think /
// setStatus / trackLLMTokens) + pure utilities (detectLanguage /
// appendBiasDisclaimer) now live in `./research/stages.ts`. This file
// keeps only:
//   - `resolveConfig` — pure config builder (uses envInt only)
//   - `runResearch`   — the orchestrator that calls the stages in order
// And re-exports `generatePlan` + `detectLanguage` for backward compat
// with tests + callers that import them from `../research-engine`.

import * as Sentry from "@sentry/nextjs";

import { getJob } from "./research-store";
import { setCachedResearch } from "./research-cache";
import { releaseConcurrency } from "./rate-limit";
import { envInt } from "./env";
import { logger } from "./logger";
import { randomUUID } from "crypto";
import type {
  ResearchConfig,
  SubQuery,
} from "./research/types";
// Re-export the public stage surface so existing callers (tests, API
// routes, the research barrel) can keep importing from `../research-engine`.
export {
  generatePlan,
  detectLanguage,
  log,
  think,
  setStatus,
  trackLLMTokens,
  appendBiasDisclaimer,
  decompose,
  processSubQuery,
  extractFindings,
  analyzeGaps,
  selfCritiquePass,
  synthesizeReport,
} from "./research/stages";
// Import the stages + helpers for the orchestrator below.
import {
  log,
  think,
  setStatus,
  generatePlan,
  decompose,
  processSubQuery,
  analyzeGaps,
  synthesizeReport,
} from "./research/stages";
import { runWithConcurrency } from "./concurrency";

// ════════════════════════════════════════════════════════════════
// CONFIG RESOLUTION
// ════════════════════════════════════════════════════════════════

export function resolveConfig(
  query: string,
  overrides?: Partial<ResearchConfig>
): ResearchConfig {
  // the engine decides depth automatically based on query
  // complexity. No user-facing settings. Short question = standard. Long
  // brief = advanced. The engine adapts.
  const queryLen = query.length;
  const autoDepth: ResearchConfig["depth"] =
    queryLen > 4000 ? "advanced" : queryLen > 500 ? "deep" : "standard";
  const depth = (overrides?.depth || autoDepth) as ResearchConfig["depth"];

  const depthPresets: Record<
    ResearchConfig["depth"],
    {
      numSubQueries: number;
      maxLinksPerQuery: number;
      numGapQueries: number;
      enableMultiRound: boolean;
    }
  > = {
    quick: {
      numSubQueries: 1,
      maxLinksPerQuery: 3,
      numGapQueries: 0,
      enableMultiRound: false,
    },
    standard: {
      numSubQueries: 3,
      maxLinksPerQuery: 4,
      numGapQueries: 0,
      enableMultiRound: false,
    },
    deep: {
      numSubQueries: 5,
      maxLinksPerQuery: 8,
      numGapQueries: 2,
      enableMultiRound: true,
    },
    advanced: {
      numSubQueries: envInt("NUM_SUB_QUERIES", 7, 2, 12),
      maxLinksPerQuery: envInt("MAX_LINKS_PER_QUERY", 15, 3, 25),
      numGapQueries: envInt("NUM_GAP_QUERIES", 3, 0, 6),
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
      overrides?.reportMaxTokens ?? envInt("REPORT_MAX_TOKENS", 6000, 1000, 32000),
    retriever: "duckduckgo" as const,
    llmProvider:
      overrides?.llmProvider ??
      ("nvidia" as ResearchConfig["llmProvider"]),
    enableMultiRound:
      overrides?.enableMultiRound ?? preset.enableMultiRound,
    numGapQueries: overrides?.numGapQueries ?? preset.numGapQueries,
  };
}

// ════════════════════════════════════════════════════════════════
// ORCHESTRATOR — runResearch(jobId)
// ════════════════════════════════════════════════════════════════

export async function runResearch(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  job.startedAt = Date.now();
  job.updatedAt = Date.now();

  // Server-side hard timeout: abort the whole pipeline after 20 minutes so a
  // stuck job cannot run forever (the client polling timeout is separate and
  // only stops the *client* from waiting — the server keeps burning resources
  // without this). 20 min > advanced depth (~15 min) to allow headroom.
  const SERVER_TIMEOUT_MS = 20 * 60 * 1000;
  const serverDeadline = job.startedAt + SERVER_TIMEOUT_MS;
  const timeoutChecker = setInterval(() => {
    if (Date.now() > serverDeadline && job.status !== "completed" && job.status !== "failed") {
      job.error = `Server-side timeout: job exceeded ${SERVER_TIMEOUT_MS / 60000} minutes.`;
      setStatus(job, "failed");
      log(job, "error", "failed", job.error);
    }
  }, 30_000);

  try {
    // Helper: throw if the user cancelled the job. Called before each stage.
    const checkCancelled = () => {
      if (job.cancelled) {
        throw new Error("Cancelled by user");
      }
    };

    // ─── STAGE 1: PLAN ────────────────────────────────────────────
    checkCancelled();
    // Job-wide URL set: prevents the same article being added to job.sources
    // by multiple sub-queries (Wikipedia/GitHub often return the same URL
    // for related sub-questions).
    const jobSeenUrls = new Set<string>();
    if (job.plan && job.plan.sections.length > 0) {
      log(job, "info", "planning", `Using pre-approved plan: "${job.plan.title}" (${job.plan.sections.length} sections)`);
    } else {
      await generatePlan(job, job.config);
    }

    // ─── STAGE 2: DECOMPOSE (round 1) ─────────────────────────────
    checkCancelled();
    const round1SubQueries = await decompose(job, job.config, 1, job.config.numSubQueries);

    // ─── STAGES 3-5: PROCESS ROUND-1 SUB-QUERIES IN PARALLEL ──────
    checkCancelled();
    // Set job status to "searching" BEFORE the parallel processing starts,
    // so the status endpoint reflects the current activity immediately
    // (not stuck on "decomposing" while sub-queries are already searching).
    setStatus(job, "searching");
    log(
      job,
      "info",
      "searching",
      `Round 1 — processing ${round1SubQueries.length} sub-questions in parallel...`
    );
    // 7b v5 audit fix: bound round-1 fan-out to 3 concurrent
    // processSubQuery calls. Each processSubQuery fires its own
    // searchWeb + readPages + extractFindings chain — unbounded
    // Promise.all would fan out N×M×K upstream HTTP requests, blowing
    // the NVIDIA free-tier rate limit (3 concurrent). The mapper's
    // `.catch()` ensures a single failure doesn't reject the batch.
    await runWithConcurrency(
      round1SubQueries,
      (sq, i) => {
        log(
          job,
          "info",
          "searching",
          `Round 1 — started sub-question ${i + 1}/${round1SubQueries.length}: "${sq.question}"`
        );
        return processSubQuery(job, sq, job.config, jobSeenUrls).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          sq.status = "failed";
          sq.error = msg;
          sq.finishedAt = Date.now();
          log(job, "error", "searching", `Sub-question failed: "${sq.question}" — ${msg}`);
        });
      },
      3,
    );
    log(job, "success", "searching", `Round 1 complete — all ${round1SubQueries.length} sub-questions processed.`);
    think(job, "searching",
      `Round 1 complete. I searched ${round1SubQueries.length} sub-questions, read ${job.stats.totalPagesRead} pages, and found ${job.stats.totalPagesSucceeded} with usable content.`,
      job.config.enableMultiRound ? "Now I'll review what I found and identify knowledge gaps for a second research round." : "Now I'll synthesize everything into a comprehensive report."
    );
    job.stats.roundsCompleted = 1;

    // adaptive refinement: if too many sub-queries failed (more than half),
    // retry the failed ones with simplified queries before moving on.
    const failedRound1 = round1SubQueries.filter(sq => sq.status === "failed");
    if (failedRound1.length > round1SubQueries.length / 2 && round1SubQueries.length > 1) {
      log(job, "warn", "searching", `${failedRound1.length}/${round1SubQueries.length} sub-queries failed. Retrying with simplified queries...`);
      think(job, "searching",
        `Too many sub-queries failed. I'll retry with shorter, simpler search queries.`
      );
      for (const sq of failedRound1) {
        // simplify: take first 80 chars of the question
        const simplified = sq.question.slice(0, 80).trim();
        sq.question = simplified;
        sq.status = "pending";
        sq.error = undefined;
        sq.searchResults = [];
        sq.pagesRead = 0;
        sq.pagesSucceeded = 0;
        try {
          await processSubQuery(job, sq, job.config, jobSeenUrls);
        } catch (err) {
          // Non-critical: adaptive retry of a single failed sub-query didn't
          // recover. The sub-query is left in "failed" status — the report
          // synthesizes with whatever round-1 findings we have. The retry
          // loop continues to the next failed sub-query.
          Sentry.captureException(err);
          logger.warn(
            { module: "research-engine", subQuery: sq.id, err: err instanceof Error ? err.message : String(err) },
            "processSubQuery retry failed — leaving sub-query in failed state"
          );
        }
      }
      log(job, "info", "searching", `Adaptive retry complete. ${failedRound1.filter(sq => sq.status === "done").length}/${failedRound1.length} recovered.`);
    }

    // ─── STAGES 4 + 5: GAP ANALYSIS + ROUND 2 ─────────────────────
    checkCancelled();
    if (job.config.enableMultiRound && job.config.numGapQueries > 0) {
      try {
        await analyzeGaps(job, job.config);

        const followUps = job.round2FollowUps;
        if (followUps.length > 0) {
          checkCancelled();
          const round2Count = Math.min(followUps.length, job.config.numGapQueries);
          const round2Questions = followUps.slice(0, round2Count);

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

          log(
            job,
            "info",
            "searching",
            `Round 2 — processing ${round2SubQueries.length} gap-fills in parallel...`
          );
          // 7b v5 audit fix: same bounded-concurrency cap as round 1
          // (3 concurrent) — gap-fills are the same per-subquery LLM
          // fan-out, just for fewer items.
          await runWithConcurrency(
            round2SubQueries,
            (sq, i) => {
              log(
                job,
                "info",
                "searching",
                `Round 2 — started gap-fill ${i + 1}/${round2SubQueries.length}: "${sq.question}"`
              );
              return processSubQuery(job, sq, job.config, jobSeenUrls).catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                sq.status = "failed";
                sq.error = msg;
                sq.finishedAt = Date.now();
                log(job, "error", "searching", `Gap-fill failed: "${sq.question}" — ${msg}`);
              });
            },
            3,
          );
          log(job, "success", "searching", `Round 2 complete.`);
          job.stats.roundsCompleted = 2;
        } else {
          log(job, "info", "analyzing_gaps", "No follow-up questions generated; skipping round 2.");
        }
      } catch (err) {
        // Non-critical: the multi-round gap-analysis phase failed (LLM
        // outage, network). The report still synthesizes from round-1
        // findings — round 2 is a quality enhancement, not a hard dep.
        //
        // IMPORTANT: cancellation errors MUST be re-thrown so the
        // orchestrator's try/finally can clean up. Swallowing them would
        // make Stop-button cancellation silently fail.
        Sentry.captureException(err);
        if (err instanceof Error && err.message === "Cancelled by user") throw err;
        const msg = err instanceof Error ? err.message : String(err);
        log(job, "warn", "analyzing_gaps", `Multi-round phase skipped due to error: ${msg}`);
      }
    }

    // ─── STAGE 6: SYNTHESIZE FINAL REPORT ─────────────────────────
    checkCancelled();
    // Guard: fail the job if there is not enough real source material to
    // synthesize from. Checking only "any findings" is insufficient — a single
    // sub-query with 50 chars of findings would pass while 6 others failed,
    // producing a near-empty hallucinated report. Instead we require both:
    //   (a) at least one sub-query with substantive findings (>200 chars), AND
    //   (b) at least one page successfully read across the whole job.
    const substantiveFindings = job.subQueries.some(
      (sq) => sq.keyFindings && sq.keyFindings.length > 200
    );
    const anyPagesRead = job.stats.totalPagesSucceeded > 0;
    if (
      job.subQueries.length > 0 &&
      (!substantiveFindings || !anyPagesRead)
    ) {
      throw new Error(
        "Insufficient source material to synthesize a report " +
          `(findings: ${substantiveFindings ? "yes" : "no"}, pages read: ${job.stats.totalPagesSucceeded}). ` +
          "Check API keys, quotas, and network connectivity, then retry."
      );
    }

    job.report = await synthesizeReport(job, job.config);
    // Persist the report so it survives server restarts.
    const { persistJob } = await import("./research-store");
    persistJob(job);

    // Citation verification (Phase 2A): check that all URLs cited in the
    // report actually exist in job.sources. Hallucinated URLs = unverified.
    if (job.report && job.sources.length > 0) {
      try {
        const { verifyAllCitations } = await import("./citation-verifier");
        job.verificationReport = verifyAllCitations(job.report, job.sources);
        log(
          job,
          "info",
          "completed",
          `Citation verification: ${job.verificationReport.verified}/${job.verificationReport.total} verified, ${job.verificationReport.unverified} unverified.`
        );
      } catch (e) {
        logger.warn(
          { module: "citation", err: e instanceof Error ? e.message : String(e) },
          "Verification failed"
        );
      }
    }

    setStatus(job, "completed");
    log(
      job,
      "success",
      "completed",
      `Deep research completed in ${Math.round(
        (Date.now() - (job.startedAt || Date.now())) / 1000
      )}s across ${job.stats.roundsCompleted} round(s). Read ${job.stats.totalPagesRead} pages from ${job.subQueries.length} sub-questions.`
    );

    // Cache the completed research result so an identical query within 24h
    // is served from cache (see research-start/route.ts). Skipped if the
    // report is empty (e.g. a guard tripped before synthesis).
    //
    // A-3: the cache key includes job.userId so one user's cached results
    // are never served to another user.
    if (job.report) {
      try {
        setCachedResearch(job.config.query, job.userId || "default", {
          report: job.report,
          sources: job.sources,
          stats: job.stats,
          plan: job.plan,
        });
      } catch (err) {
        Sentry.captureException(err);
        logger.warn(
          { module: "research-cache", err: err instanceof Error ? err.message : String(err) },
          "setCachedResearch failed — non-fatal"
        );
      }
    }

    // Auto-save the completed research to the session store (Phase D).
    try {
      const { createSession } = await import("./session-store");
      createSession(
        "research",
        job.config.query.slice(0, 200),
        `Read ${job.stats.totalPagesRead} pages · ${job.sources.length} sources · ${job.report.length} chars`,
        job.report,
        {
          tokensUsed: job.stats.totalTokensUsed,
          pagesRead: job.stats.totalPagesRead,
          pagesSucceeded: job.stats.totalPagesSucceeded,
          sourcesCount: job.sources.length,
          rounds: job.stats.roundsCompleted,
          elapsedMs: job.stats.elapsedMs,
          depth: job.config.depth,
        },
        "completed"
      );
    } catch (e) {
      logger.warn(
        { module: "session-store", err: e instanceof Error ? e.message : String(e) },
        "Failed to save research session"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't overwrite the "Cancelled by user" error if the stop endpoint
    // already set it. The cancelled flag is the source of truth.
    if (job.cancelled) {
      job.error = "Cancelled by user";
      setStatus(job, "failed");
      log(job, "info", "failed", "Research cancelled by user.");
    } else {
      job.error = msg;
      setStatus(job, "failed");
      log(job, "error", "failed", `Research failed: ${msg}`);
    }
  } finally {
    // Stop the server-side timeout checker (otherwise it leaks as a dangling timer).
    clearInterval(timeoutChecker);
    // Release the rate-limit concurrency slot for this client, whether the
    // job succeeded or failed. This prevents permanent concurrency exhaustion.
    if (job.clientIP) {
      releaseConcurrency(job.clientIP);
    }
  }
}
