import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, speed } = body;
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Text is required." }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ ok: false, error: "Text exceeds 4000 character limit." }, { status: 400 });
    }
    const result = await synthesizeSpeech({ text, voice, speed });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "TTS failed." }, { status: 500 });
  }
}
