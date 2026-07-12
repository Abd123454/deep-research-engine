// GET /api/research/stream/[id]
// Server-Sent Events stream for a research job.
//
// Replaces polling (/api/research/status/[id]) for clients that support SSE.
// The server pushes a JSON snapshot of the job every time it updates, plus a
// final "completed" or "failed" event. This reduces network traffic by ~99%
// (1 long-lived connection instead of 600 polls at 1.5s intervals).
//
// Client usage:
//   const es = new EventSource(`/api/research/stream/${id}`);
//   es.addEventListener("update", (e) => setJob(JSON.parse(e.data)));
//   es.addEventListener("done", () => es.close());

import { NextRequest } from "next/server";
import { getJob } from "@/lib/research-store";
import { toPublicJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How often to poll the in-memory store for changes (ms). The store is updated
// synchronously by the research engine, so this is just a sampling interval.
const SAMPLE_INTERVAL_MS = 800;
// Hard cap on how long a single SSE connection stays open (30 min).
const MAX_STREAM_DURATION_MS = 30 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return new Response(JSON.stringify({ ok: false, error: "Job not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let lastUpdate = 0;
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

      const startedAt = Date.now();
      const interval = setInterval(() => {
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

        // Only push if the job actually changed (updatedAt bumped).
        if (current.updatedAt !== lastUpdate) {
          lastUpdate = current.updatedAt;
          send("update", { ok: true, job: toPublicJob(current) });
        }

        // Terminal state — send final event and close.
        if (current.status === "completed" || current.status === "failed") {
          send("done", {
            ok: true,
            status: current.status,
            error: current.error,
          });
          cleanup();
        }
      }, SAMPLE_INTERVAL_MS);

      function cleanup() {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      // Clean up if the client disconnects.
      _req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (Caddy/Nginx)
    },
  });
}
