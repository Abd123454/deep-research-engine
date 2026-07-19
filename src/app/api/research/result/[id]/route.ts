// GET /api/research/result/[id]
// Returns the final report + sources + sub-queries for a completed job.

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/research-store";
import { toPublicJob } from "@/lib/types";
import { requireAuth, getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { ok: false, error: "Job not found." },
      { status: 404 }
    );
  }

  // Ownership check (v6 audit fix): only the user who STARTED the job may
  // read its result. Without this, any authenticated user could read
  // another user's research report by guessing/enumerating job IDs.
  // Mirrors the check in /api/research/stop/[id] (added in v4).
  if (job.userId && job.userId !== userId) {
    return NextResponse.json(
      { ok: false, error: "Not authorized to view this job." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, job: toPublicJob(job) });
}
