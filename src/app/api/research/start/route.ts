// POST /api/research/start
// Starts a new deep research job. Runs asynchronously in the background.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createJob } from "@/lib/research-store";
import { resolveConfig, runResearch } from "@/lib/research-engine";
import { getLLMProvider, getSmartModels, getFastModel } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import { checkStartRateLimit, getClientIP } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ... StartBodySchema unchanged ...

// Hard limit on query length (100k chars ≈ 25k tokens, within modern context windows).
const MAX_QUERY_CHARS = 100_000;

// Strict input validation with zod (previously parsed manually — allowed prompt
// injection via invalid `depth` values and bypassing the numSubQueries/maxLinks caps).
const StartBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required.").max(MAX_QUERY_CHARS),
  depth: z.enum(["standard", "deep", "advanced"]).optional(),
  numSubQueries: z.number().int().min(2).max(12).optional(),
  maxLinksPerQuery: z.number().int().min(3).max(25).optional(),
  reportMaxTokens: z.number().int().min(1000).max(32000).optional(),
  // Optional: a pre-approved/edited plan from the "Plan Preview" step.
  // If provided, the engine skips generatePlan and uses this one.
  // title/summary must be non-empty (z.string() accepts "").
  // Sections capped at 9 (matches generatePlan's internal limit).
  plan: z
    .object({
      title: z.string().min(1, "Title cannot be empty."),
      summary: z.string().min(1, "Summary cannot be empty."),
      sections: z
        .array(
          z.object({
            id: z.string(),
            title: z.string().min(1, "Section title cannot be empty."),
            description: z.string(),
          })
        )
        .min(1, "At least 1 section required.")
        .max(9, "Maximum 9 sections allowed."),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Auth check (no-op if AUTH_USERNAME/AUTH_PASSWORD are unset).
    const authFail = requireAuth(req);
    if (authFail) return authFail;

    const raw = await req.json().catch(() => ({}));
    const parsed = StartBodySchema.safeParse(raw);
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

    // Rate limiting: protect free-tier API quotas from abuse.
    const clientIP = getClientIP(req);
    const rateLimit = checkStartRateLimit(clientIP);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { ok: false, error: rateLimit.reason },
        {
          status: 429,
          headers: rateLimit.retryAfterSec
            ? { "Retry-After": String(rateLimit.retryAfterSec) }
            : undefined,
        }
      );
    }

    // Resolve config from env + validated client overrides.
    const config = resolveConfig(query, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    const job = createJob(query, config, clientIP);

    // If a pre-approved plan was provided (Plan Preview step), attach it
    // so the engine skips plan generation.
    if (body.plan) {
      job.plan = body.plan;
    }

    // Fire-and-forget the research pipeline. We do NOT await it here —
    // the client polls /api/research/status/[id] for progress.
    runResearch(job.id).catch((err: unknown) => {
      console.error(`[research] runResearch(${job.id}) threw:`, err);
    });

    return NextResponse.json({
      ok: true,
      id: job.id,
      status: job.status,
      config: {
        depth: config.depth,
        numSubQueries: config.numSubQueries,
        maxLinksPerQuery: config.maxLinksPerQuery,
        reportMaxTokens: config.reportMaxTokens,
        retriever: config.retriever,
        llmProvider: getLLMProvider(),
        smartModels: getSmartModels(),
        fastModel: getFastModel(),
        searchEngines: ["tavily", "zai", "duckduckgo"],
      },
      retriever: getRetriever(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
