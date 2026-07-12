// POST /api/research/stop/[id]
// Cancels a running research job.
//
// Marks the job as "failed" with error "Cancelled by user". The research
// pipeline (running as fire-and-forget) will see the failed status on its
// next status check and abort. The client stops SSE/polling immediately.
//
// TODO: proper cancellation would require AbortController propagation
// through the entire pipeline (search → read → extract → synthesize).
// Currently the pipeline may continue running server-side after stop,
// wasting API budget. The result is discarded (job is already "failed").

import { NextRequest, NextResponse } from "next/server";
import { getJob, deleteJob } from "@/lib/research-store";
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

  // Mark as failed with cancellation message.
  // The UI checks job.error to distinguish "cancelled" from real failures.
  job.error = "Cancelled by user";
  job.status = "failed";
  job.finishedAt = Date.now();
  job.updatedAt = Date.now();

  return NextResponse.json({ ok: true, id, status: "failed" });
}
