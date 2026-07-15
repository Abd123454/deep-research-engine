import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/asr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, format, language } = body;
    if (!audio) {
      return NextResponse.json({ ok: false, error: "Audio data is required." }, { status: 400 });
    }
    const result = await transcribeAudio(audio, format || "webm", language);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "ASR failed." }, { status: 500 });
  }
}
