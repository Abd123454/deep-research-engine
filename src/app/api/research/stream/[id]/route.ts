// GET /api/research/stream/[id]
// Server-Sent Events stream for a research job.
//
// Emits 3 types of events:
//   1. "update" — full job snapshot (status, stats, sub-queries, etc.)
//   2. "report_token" — a single token from the streaming report
//   3. "done" — terminal state (completed/failed)
//
// Client usage:
//   const es = new EventSource(`/api/research/stream/${id}`);
//   es.addEventListener("update", (e) => setJob(JSON.parse(e.data)));
//   es.addEventListener("report_token", (e) => appendToken(JSON.parse(e.data).token));
//   es.addEventListener("done", () => es.close());
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/research-store";
import { toPublicJob } from "@/lib/types";
import { requireAuth, getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_INTERVAL_MS = 800;
const STREAMING_SAMPLE_INTERVAL_MS = 100; // faster polling during report streaming
const MAX_STREAM_DURATION_MS = 30 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return new NextResponse(JSON.stringify({ ok: false, error: "Job not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ownership check (v6 audit fix): only the user who STARTED the job may
  // stream it. Without this, any authenticated user could read another
  // user's research report + sub-queries by guessing/enumerating job IDs.
  // Mirrors the check in /api/research/stop/[id] (added in v4). In
  // single-tenant Basic-Auth deployments `job.userId` defaults to "default"
  // and the check is a no-op (every user resolves to "default").
  if (job.userId && job.userId !== userId) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Not authorized to view this job." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let lastUpdate = 0;
      let lastStreamIndex = 0; // track how many report tokens we've sent
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Send initial state immediately.
      send("update", { ok: true, job: toPublicJob(job) });

      // if the client is reconnecting and the report has already
      // been partially streamed, replay the full buffered content so the
      // user doesn't lose what was already shown. This handles refresh/
      // reconnect during synthesis.
      if (job.reportStream.length > 0) {
        send("report_token", { tokens: job.reportStream.join("") });
        lastStreamIndex = job.reportStream.length;
      }

      const startedAt = Date.now();
      let currentInterval: ReturnType<typeof setInterval> | null = null;

      function tick() {
        if (closed) return;
        if (Date.now() - startedAt > MAX_STREAM_DURATION_MS) {
          send("error", { ok: false, error: "Stream timeout (30 min)." });
          cleanup();
          return;
        }

        const current = getJob(id);
        if (!current) {
          send("error", { ok: false, error: "Job evicted from memory." });
          cleanup();
          return;
        }

        // Push status updates when the job changes.
        if (current.updatedAt !== lastUpdate) {
          lastUpdate = current.updatedAt;
          send("update", { ok: true, job: toPublicJob(current) });
        }

        // push report tokens as they arrive.
        if (current.reportStream.length > lastStreamIndex) {
          const newTokens = current.reportStream.slice(lastStreamIndex);
          lastStreamIndex = current.reportStream.length;
          send("report_token", { tokens: newTokens.join("") });
        }

        // Adaptive interval: poll faster (100ms) while report is streaming,
        // slower (800ms) otherwise.
        const desiredInterval = current.reportStreaming
          ? STREAMING_SAMPLE_INTERVAL_MS
          : SAMPLE_INTERVAL_MS;

        if (currentInterval) clearInterval(currentInterval);
        currentInterval = setInterval(tick, desiredInterval);

        // Terminal state.
        if (current.status === "completed" || current.status === "failed") {
          if (current.reportStream.length > lastStreamIndex) {
            const newTokens = current.reportStream.slice(lastStreamIndex);
            lastStreamIndex = current.reportStream.length;
            send("report_token", { tokens: newTokens.join("") });
          }
          send("done", {
            ok: true,
            status: current.status,
            error: current.error,
          });
          cleanup();
        }
      }

      // Start the first tick immediately.
      currentInterval = setInterval(tick, SAMPLE_INTERVAL_MS);

      function cleanup() {
        closed = true;
        if (currentInterval) clearInterval(currentInterval);
        try {
          controller.close();
        } catch (err) {
  Sentry.captureException(err);
// already closed
        
}
      }

      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
