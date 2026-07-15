// POST /api/vision — analyze an image using vision LLM.
// Body: { image: base64, mimeType, prompt? }

import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/vision";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType, prompt } = body;

    if (!image || !mimeType) {
      return NextResponse.json(
        { ok: false, error: "image (base64) and mimeType are required." },
        { status: 400 }
      );
    }

    const result = await analyzeImage(image, mimeType, prompt);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Vision analysis failed." },
      { status: 500 }
    );
  }
}
