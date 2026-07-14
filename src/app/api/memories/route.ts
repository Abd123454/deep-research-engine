// GET  /api/memories — list user's long-term memories.
// POST /api/memories — manually add a memory.

import { NextRequest, NextResponse } from "next/server";
import { getMemories, storeMemories, type MemoryExtraction } from "@/lib/memory-extractor";

export async function GET() {
  const memories = await getMemories(null);
  return NextResponse.json({ ok: true, memories });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const memories: MemoryExtraction[] = Array.isArray(body.memories) ? body.memories : [];
    if (memories.length === 0) {
      return NextResponse.json({ ok: false, error: "No memories provided." }, { status: 400 });
    }
    const stored = await storeMemories(null, memories);
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
