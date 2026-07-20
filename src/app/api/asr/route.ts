import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { transcribeAudio } from "@/lib/asr";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const { audio, format, language } = body;
    if (!audio) {
      return NextResponse.json({ ok: false, error: "Audio data is required." }, { status: 400 });
    }
    const result = await transcribeAudio(audio, format || "webm", language);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "ASR failed." }, { status: 500 });
  }
}
