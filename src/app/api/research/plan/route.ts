// POST /api/research/plan
// Generates ONLY the research plan (no searching, no reading, no report).
// The client shows this plan to the user for approval/editing before
// committing to a full research run.
//
// BUG FIX: previously this route called `createJob` which leaked a job into
// the in-memory store every time the user clicked "Start" then "Cancel" (or
// just closed the tab). After 30 cancels, the store would be full and reject
// new jobs. Now we create a DUMMY job object (not stored) just to pass to
// generatePlan (which needs it for logging/status). No store pollution.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLLMProvider, getSmartModels, getFastModel } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import { requireAuth } from "@/lib/auth";
import { generatePlan, resolveConfig } from "@/lib/research-engine";
import type { ResearchJob, ResearchPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 100_000;

const PlanBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required.").max(MAX_QUERY_CHARS),
  depth: z.enum(["standard", "deep", "advanced"]).optional(),
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

    const config = resolveConfig(query, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    // Create a DUMMY job (NOT stored in the in-memory store) just so
    // generatePlan can use it for logging/status. This avoids the job leak.
    // TODO: this is a dummy job, not persisted. generatePlan should be
    // refactored to not need a full job object (it only uses it for log/status).
    const dummyJob: ResearchJob = {
      id: `plan-only-${Date.now()}`,
      query,
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
      },
      cancelled: false,
      reportStream: [],
      reportStreaming: false,
      thoughts: [],
      followUpQuestions: [],
      clarifyingQuestions: [],
    };

    const plan: ResearchPlan = await generatePlan(dummyJob, config);

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
