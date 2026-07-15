// POST /api/research/stop/[id]
// Cancel a running job — real cancellation via AbortController.
//
// Two things happen:
//   1. job.abortController.abort() — cancels all in-flight fetch() calls
//      (search, page reads) immediately. They throw AbortError.
//   2. job.cancelled = true — the pipeline checks this before each stage
//      as a cooperative fallback (in case a request already completed).

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/research-store";
import { persistJob } from "@/lib/research-store";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found." },
      { status: 404 }
    );
  }

  // 1. Abort all in-flight HTTP requests (real cancellation).
  if (job.abortController) {
    job.abortController.abort("Cancelled by user");
  }

  // 2. Set the cooperative cancel flag (checked before each stage).
  job.cancelled = true;
  job.error = "Cancelled by user";
  job.status = "failed";
  job.finishedAt = Date.now();
  job.updatedAt = Date.now();

  // Persist the cancellation so it survives server restarts.
  persistJob(job);

  return NextResponse.json({ ok: true, id, status: "failed" });
}
