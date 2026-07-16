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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TASK_LENGTH = 2000;

export async function POST(req: NextRequest) {
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
  trackEvent("default", "feature_used", { feature: "swarm" });
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
        await runSwarm(task, emit);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
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
