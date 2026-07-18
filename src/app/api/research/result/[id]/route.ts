// GET /api/research/result/[id]
// Returns the final report + sources + sub-queries for a completed job.

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/research-store";
import { toPublicJob } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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
  return NextResponse.json({ ok: true, job: toPublicJob(job) });
}
