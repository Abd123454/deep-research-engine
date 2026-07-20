// GET  /api/memories — list user's long-term memories.
// POST /api/memories — manually add a memory.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getMemories, storeMemories, type MemoryExtraction } from "@/lib/memory-extractor";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const memories = await getMemories(null);
  return NextResponse.json({ ok: true, memories });
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  let body: { memories?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const memories: MemoryExtraction[] = Array.isArray(body.memories) ? (body.memories as MemoryExtraction[]) : [];
  if (memories.length === 0) {
    return NextResponse.json({ ok: false, error: "No memories provided." }, { status: 400 });
  }
  try {
    const stored = await storeMemories(null, memories);
    return NextResponse.json({ ok: true, stored });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Failed to store memories." }, { status: 500 });
  }
}
