// POST /api/research/start
// Starts a new deep research job. Runs asynchronously in the background.

import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { z } from "zod";
import { createJob } from "@/lib/research-store";
import { resolveConfig, runResearch } from "@/lib/research-engine";
import { getLLMProvider, getSmartModels, getFastModel } from "@/lib/llm-provider";
import { getRetriever } from "@/lib/retriever";
import { checkStartRateLimit, getClientIP } from "@/lib/rate-limit";
import { requireAuth, getUserId } from "@/lib/auth";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { logger } from "@/lib/logger";
import { logSensitiveAction } from "@/lib/audit";
import { enqueueResearch, isQueueAvailable } from "@/lib/queue";
import { getCachedResearch } from "@/lib/research-cache";
import { persistJob } from "@/lib/research-store";
import { checkLimit as checkPlanLimit } from "@/lib/plan-limits";

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

    const userId = getUserId(req);
    // SENSITIVE ACTION: research start kicks off a long-running pipeline
    // that consumes API quotas and may produce/export artifacts. Logged
    // at the start so even an attempted-but-failed start is recorded.
    logSensitiveAction("research.start", userId, req);

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

    // Rate limiting: protect free-tier API quotas from abuse.
    const clientIP = getClientIP(req);
    const rateLimit = await checkStartRateLimit(clientIP);
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

    // ---------- Plan limit enforcement ----------
    // Reject with 402 Payment Required when the user's plan quota for the
    // current month is exhausted. The Free plan defaults to 10 research/mo
    // — generous enough that a fresh in-memory DB (used by tests) never
    // trips the gate. Cache hits do NOT bypass this check, because the
    // cache is shared across users and the quota is per-user.
    const planCheck = checkPlanLimit(userId, "research");
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your plan's monthly research limit has been reached. Upgrade at /pricing to run more queries.",
          plan: planCheck.plan,
          limit: planCheck.limit,
          remaining: planCheck.remaining,
        },
        { status: 402 }
      );
    }

    // Resolve config from env + validated client overrides.
    const config = resolveConfig(cleanedQuery, {
      depth: body.depth,
      numSubQueries: body.numSubQueries,
      maxLinksPerQuery: body.maxLinksPerQuery,
      reportMaxTokens: body.reportMaxTokens,
    });

    const job = createJob(cleanedQuery, config, clientIP);
    trackEvent("default", "research_started", { jobId: job.id, queryLength: cleanedQuery.length });

    // If a pre-approved plan was provided (Plan Preview step), attach it
    // so the engine skips plan generation.
    if (body.plan) {
      job.plan = body.plan;
    }

    // ---------- Research result cache ----------
    // Before enqueuing/running, check if we already have a cached result for
    // this exact query (24h TTL). If hit AND no pre-approved plan was supplied
    // (a custom plan means the user explicitly wants a different shape),
    // hydrate the in-memory job as "completed" and return immediately.
    // This avoids re-running the 5-15 min pipeline for repeat queries.
    if (!body.plan) {
      const cached = getCachedResearch(cleanedQuery);
      if (cached) {
        job.status = "completed";
        job.report = cached.report;
        job.sources = cached.sources;
        job.plan = cached.plan;
        // Merge cached stats (keep clientIP from the new job).
        job.stats = { ...cached.stats };
        job.finishedAt = Date.now();
        job.updatedAt = Date.now();
        persistJob(job);
        trackEvent("default", "research_cache_hit", { jobId: job.id });
        logger.info(
          { module: "research", jobId: job.id, cacheAgeMs: Date.now() - cached.cachedAt },
          "Research cache hit — returning cached result"
        );
        return NextResponse.json({
          ok: true,
          id: job.id,
          status: job.status,
          cached: true,
          config: {
            depth: config.depth,
            numSubQueries: config.numSubQueries,
            maxLinksPerQuery: config.maxLinksPerQuery,
            reportMaxTokens: config.reportMaxTokens,
            retriever: config.retriever,
            llmProvider: getLLMProvider(),
            smartModels: getSmartModels(),
            fastModel: getFastModel(),
            searchEngines: ["duckduckgo"],
          },
          retriever: getRetriever(),
        });
      }
    }

    // ---------- Dispatch: BullMQ (if Redis) or inline fallback ----------
    // When REDIS_URL is set, enqueue the job — the worker process
    // (worker.ts → research-worker.ts) picks it up and runs runResearch().
    // Otherwise, fire-and-forget runResearch() inline. The inline path blocks
    // the API route's event-loop slot for the duration of the pipeline
    // (~5-15 min for advanced depth) but works without external dependencies.
    if (isQueueAvailable()) {
      try {
        await enqueueResearch(job.id, cleanedQuery, "default");
      } catch (err) {
        // Enqueue failed (Redis down mid-request?) — fall back to inline
        // so the user's request still completes.
        logger.error(
          { module: "research", jobId: job.id, err: err instanceof Error ? err.message : String(err) },
          "enqueueResearch failed — falling back to inline execution"
        );
        runResearch(job.id).catch((e: unknown) => {
          logger.error(
            { module: "research", jobId: job.id, err: e instanceof Error ? e.message : String(e) },
            "runResearch threw"
          );
        });
      }
    } else {
      logger.warn(
        { module: "research", jobId: job.id },
        "REDIS_URL not set — running research inline. For production, set REDIS_URL and run `bun run worker` to use BullMQ."
      );
      runResearch(job.id).catch((err: unknown) => {
        logger.error(
          { module: "research", jobId: job.id, err: err instanceof Error ? err.message : String(err) },
          "runResearch threw"
        );
      });
    }

    return NextResponse.json({
      ok: true,
      id: job.id,
      status: job.status,
      cached: false,
      config: {
        depth: config.depth,
        numSubQueries: config.numSubQueries,
        maxLinksPerQuery: config.maxLinksPerQuery,
        reportMaxTokens: config.reportMaxTokens,
        retriever: config.retriever,
        llmProvider: getLLMProvider(),
        smartModels: getSmartModels(),
        fastModel: getFastModel(),
        searchEngines: ["duckduckgo"],
      },
      retriever: getRetriever(),
    });
  } catch {
    // Return only a generic message to the client to avoid leaking stack
    // traces or internal paths from downstream failures.
    return NextResponse.json({ ok: false, error: "Research start failed." }, { status: 500 });
  }
}
