// POST /api/research/start
// Starts a new deep research job. Runs asynchronously in the background.

import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/research-store";
import { resolveConfig, runResearch } from "@/lib/research-engine";
import { getLLMProvider } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import type { SearchDepth } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      depth?: SearchDepth;
      numSubQueries?: number;
      maxLinksPerQuery?: number;
      reportMaxTokens?: number;
    };

    const query = (body.query || "").trim();
    if (!query) {
      return NextResponse.json(
        { ok: false, error: "Query is required." },
        { status: 400 }
      );
    }
    // Allow very large prompts (giant research briefs, multi-paragraph
    // instructions, RFPs, etc.). 100k chars ≈ ~25k tokens, well within
    // modern LLM context windows (Llama 3.1/3.3 = 128k context).
    const MAX_QUERY_CHARS = 100_000;
    if (query.length > MAX_QUERY_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: `Query too long (max ${MAX_QUERY_CHARS.toLocaleString()} chars). Received ${query.length.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    // Resolve config from env + optional client overrides.
    const config = resolveConfig(query, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    const job = createJob(query, config);

    // Fire-and-forget the research pipeline. We do NOT await it here —
    // the client polls /api/research/status/[id] for progress.
    runResearch(job.id).catch((err) => {
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
      },
      retriever: getRetriever(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
