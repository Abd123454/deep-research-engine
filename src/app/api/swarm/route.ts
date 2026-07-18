// POST /api/swarm — multi-agent swarm with SSE streaming.
//
// Request: { "task": "..." }
// Response: text/event-stream
//   data: {"type":"swarm_start",...}
//   data: {"type":"agent_start",...}
//   data: {"type":"agent_token",...}
//   ...
//   data: {"type":"swarm_done","finalReport":"..."}
//
// Cancellation: client closes connection → AbortController fires.
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/analytics";


import { NextRequest } from "next/server";
import { runSwarm, serializeSSE, type SwarmEvent } from "@/lib/swarm";
import { sanitizeInput } from "@/lib/prompt-security";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { requireAuth, getUserId } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { checkLimit as checkPlanLimit } from "@/lib/plan-limits";
import { sanitizeError } from "@/lib/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TASK_LENGTH = 2000;

export async function POST(req: NextRequest) {
  // Auth: require valid credentials. Swarm consumes significant LLM tokens.
  const authError = requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  // P0-3 (per-user isolation + plan limits): gate swarm access behind
  // the plan-limits layer. The "swarm" resource is currently a
  // structural cap (max agents per plan, not a metered monthly quota),
  // so `checkLimit` returns `allowed: true` for all plans — but the
  // gate is wired up so a future change to meter swarm usage (e.g.
  // "free plan: 5 swarms/month") can be enforced by editing
  // `plan-limits-data.ts` without touching this route.
  const planCheck = checkPlanLimit(userId, "swarm");
  if (!planCheck.allowed) {
    return Response.json(
      { ok: false, error: "Swarm limit reached. Upgrade at /pricing for more concurrent agents." },
      { status: 402 }
    );
  }

  // Parse body.
  let body: { task?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawTask = (body.task || "").trim();
  if (!rawTask) {
    return Response.json({ error: "Task is required." }, { status: 400 });
  }
  if (rawTask.length > MAX_TASK_LENGTH) {
    return Response.json({ error: `Task too long (max ${MAX_TASK_LENGTH} chars).` }, { status: 400 });
  }

  // Check for LLM provider.
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOllama = !!process.env.OLLAMA_URL;
  if (!hasNvidia && !hasOpenai && !hasAnthropic && !hasOllama) {
    return Response.json({ error: "No LLM provider configured." }, { status: 503 });
  }

  // Sanitize input (blocks prompt injection).
  const task = sanitizeInput(rawTask);
  trackEvent(userId, "feature_used", { feature: "swarm" });
  logSensitiveAction("swarm.start", userId, req, { taskLength: task.length });
  if (!task) {
    return Response.json({ error: "Invalid input." }, { status: 400 });
  }

  // Rate limit.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await checkStartRateLimit(ip);
  if (!limit.ok) {
    return Response.json(
      { error: limit.reason || "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec || 60) } }
    );
  }

  // Set up SSE stream.
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SwarmEvent) => {
        try {
          controller.enqueue(encoder.encode(serializeSSE(event)));
        } catch (err) {
  Sentry.captureException(err);
// controller already closed.
        
}
      };

      try {
        // P0-3 (per-user isolation): pass the resolved userId and the
        // request's AbortSignal down to runSwarm. The userId is used
        // for audit-trail attribution and for per-user memory/tool
        // isolation inside the swarm workers. The signal lets the
        // swarm bail out cleanly when the client closes the SSE
        // stream (no more wasted LLM tokens after the user navigates
        // away).
        await runSwarm(task, emit, { userId, signal: abortController.signal });
      } catch (err) {
        // P0-10: sanitize the error before sending to the client —
        // LLM provider errors can include the request URL, Authorization
        // header, or connection string, all of which contain secrets.
        const msg = sanitizeError(err);
        emit({ type: "error", message: msg });
      } finally {
        releaseConcurrency(ip);
        try {
          controller.close();
        } catch (err) {
  Sentry.captureException(err);
// already closed
        
}
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
