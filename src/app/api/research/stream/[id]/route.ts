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

import { NextRequest } from "next/server";
import { getJob } from "@/lib/research-store";
import { toPublicJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_INTERVAL_MS = 800;
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

        // Push status updates when the job changes.
        if (current.updatedAt !== lastUpdate) {
          lastUpdate = current.updatedAt;
          send("update", { ok: true, job: toPublicJob(current) });
        }

        // CHANGE 3: push report tokens as they arrive.
        if (current.reportStream.length > lastStreamIndex) {
          const newTokens = current.reportStream.slice(lastStreamIndex);
          lastStreamIndex = current.reportStream.length;
          // Batch tokens into a single event to reduce SSE overhead.
          // Individual tokens are too chatty (1000+ events for a 6K report).
          send("report_token", { tokens: newTokens.join("") });
        }

        // Terminal state — send final event and close.
        if (current.status === "completed" || current.status === "failed") {
          // Flush any remaining tokens.
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
      "X-Accel-Buffering": "no",
    },
  });
}
