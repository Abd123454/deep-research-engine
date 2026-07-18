// POST /api/vision — analyze an image using vision LLM.
// Body: { image: base64, mimeType, prompt? }

import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { analyzeImage } from "@/lib/vision";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const { image, mimeType, prompt } = body;

    if (!image || !mimeType) {
      return NextResponse.json(
        { ok: false, error: "image (base64) and mimeType are required." },
        { status: 400 }
      );
    }

  trackEvent("default", "feature_used", { feature: "vision" });
    const result = await analyzeImage(image, mimeType, prompt);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Vision analysis failed." },
      { status: 500 }
    );
  }
}
