// POST /api/research/stop/[id]
// cancel a running job
//
//
//
// sub-queries already in-flight (inside processSubQuery's search/read
// This is acceptable — the wasted budget is at most N sub-queries × 1 request.

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/research-store";
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

  // Set the cancellation flag. The pipeline checks this before each stage.
  job.cancelled = true;
  job.error = "Cancelled by user";
  job.status = "failed";
  job.finishedAt = Date.now();
  job.updatedAt = Date.now();

  return NextResponse.json({ ok: true, id, status: "failed" });
}
