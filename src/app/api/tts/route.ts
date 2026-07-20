import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/analytics";
import { synthesizeSpeech } from "@/lib/tts";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const { text, voice, speed } = body;
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Text is required." }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ ok: false, error: "Text exceeds 4000 character limit." }, { status: 400 });
    }
  trackEvent("default", "feature_used", { feature: "tts" });
    const result = await synthesizeSpeech({ text, voice, speed });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "TTS failed." }, { status: 500 });
  }
}
