// POST /api/memories/extract — auto-extract memories from a conversation.
// Body: { conversation: [{ role, content }] }

import { NextRequest, NextResponse } from "next/server";
import { extractAndStoreMemories } from "@/lib/memory-extractor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const conversation = body.conversation as { role: string; content: string }[];
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json({ ok: false, error: "No conversation provided." }, { status: 400 });
    }

    // Combine conversation into a single text for extraction.
    const text = conversation
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const stored = await extractAndStoreMemories(null, text);
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ ok: false, error: "Extraction failed." }, { status: 500 });
  }
}
