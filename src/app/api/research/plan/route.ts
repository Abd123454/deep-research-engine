// POST /api/research/plan
// Generates ONLY the research plan (no searching, no reading, no report).
// The client shows this plan to the user for approval/editing before
// committing to a full research run.
//
// the in-memory store every time the user clicked "Start" then "Cancel" (or
// just closed the tab). After 30 cancels, the store would be full and reject
// new jobs. Now we create a DUMMY job object (not stored) just to pass to
// dummy job, not stored

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLLMProvider, getSmartModels, getFastModel } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import { requireAuth } from "@/lib/auth";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { generatePlan, resolveConfig } from "@/lib/research-engine";
import type { ResearchJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 100_000;

const PlanBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required.").max(MAX_QUERY_CHARS),
  depth: z.enum(["quick", "standard", "deep", "advanced"]).optional(),
  numSubQueries: z.number().int().min(2).max(12).optional(),
  maxLinksPerQuery: z.number().int().min(3).max(25).optional(),
  reportMaxTokens: z.number().int().min(1000).max(32000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authFail = requireAuth(req);
    if (authFail) return authFail;

    const raw = await req.json().catch(() => ({}));
    const parsed = PlanBodySchema.safeParse(raw);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: firstErr
            ? `${firstErr.path.join(".") || "input"}: ${firstErr.message}`
            : "Invalid request body.",
        },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const query = body.query;

    // Prompt-injection defense: BLOCK (not just warn) if malicious patterns
    // are detected. The query never reaches the LLM if blocked.
    const injectionCheck = sanitizeQuery(query);
    if (injectionCheck.blocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Request blocked: potential prompt injection detected.",
          reason: injectionCheck.reason,
        },
        { status: 400 }
      );
    }

    // Input sanitization: strip SQL injection / XSS / command injection
    // patterns from the query before it reaches the LLM or gets stored.
    const cleanedQuery = sanitizeInput(injectionCheck.sanitized);

    const config = resolveConfig(cleanedQuery, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    // Create a DUMMY job (NOT stored in the in-memory store) just so
    // generatePlan can use it for logging/status. This avoids the job leak.
    // dummy job, not stored
    // refactored to not need a full job object (it only uses it for log/status).
    const dummyJob: ResearchJob = {
      id: `plan-only-${Date.now()}`,
      query: cleanedQuery,
      status: "planning",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config,
      plan: null,
      gapAnalysis: null,
      round2FollowUps: [],
      subQueries: [],
      sources: [],
      report: null,
      logs: [],
      error: null,
      stats: {
        totalPagesFound: 0,
        totalPagesRead: 0,
        totalPagesSucceeded: 0,
        totalTokensUsed: 0,
        elapsedMs: 0,
        subQueriesCompleted: 0,
        roundsCompleted: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      },
      cancelled: false,
      reportStream: [],
      reportStreaming: false,
      thoughts: [],
      followUpQuestions: [],
      clarifyingQuestions: [],
    };

    const plan = await generatePlan(dummyJob, config);

    // If the LLM failed (all 6 NVIDIA models errored, or output unparseable),
    // return 503 so the client knows the plan is a fallback — not a real plan.
    // The heuristic fallback is allowed during runResearch (long-running job),
    // but the /plan endpoint must not silently return a fake plan.
    if (plan.llmFailed) {
      return NextResponse.json(
        {
          ok: false,
          error: "LLM service unavailable. All NVIDIA models failed or produced unparseable output.",
          detail: plan.llmError || "Unknown LLM error.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      plan,
      config: {
        depth: config.depth,
        numSubQueries: config.numSubQueries,
        maxLinksPerQuery: config.maxLinksPerQuery,
        reportMaxTokens: config.reportMaxTokens,
        retriever: config.retriever,
        llmProvider: getLLMProvider(),
        smartModels: getSmartModels(),
        fastModel: getFastModel(),
      },
      retriever: getRetriever(),
    });
  } catch {
    // Return only a generic message to the client to avoid leaking stack
    // traces or internal paths from downstream failures.
    return NextResponse.json({ ok: false, error: "Plan generation failed." }, { status: 500 });
  }
}
