// POST /api/research/plan
// Generates ONLY the research plan (no searching, no reading, no report).
// The client shows this plan to the user for approval/editing before
// committing to a full research run.
//
// This is the "Plan Preview" step — it lets the user see and modify the
// outline before any API budget is spent on search + LLM synthesis.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLLMProvider, getSmartModels, getFastModel } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import { requireAuth } from "@/lib/auth";
import { generatePlan, resolveConfig } from "@/lib/research-engine";
import { createJob } from "@/lib/research-store";
import type { ResearchPlan } from "@/lib/types";

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
    // Auth check (no-op if AUTH_USERNAME/AUTH_PASSWORD are unset).
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

    // Resolve config (same as /start, but we won't run the full pipeline).
    const config = resolveConfig(query, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    // Create a job record (status: queued) so we have an ID to attach the
    // plan to. The full pipeline won't run yet.
    const job = createJob(query, config);

    // Generate ONLY the plan.
    const plan: ResearchPlan = await generatePlan(job, config);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
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
