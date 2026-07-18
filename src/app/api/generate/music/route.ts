import { NextRequest, NextResponse } from "next/server";
import { generateMusic } from "@/lib/multi-modal/generators";
import { trackEvent } from "@/lib/analytics";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  let body: { prompt?: string; options?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  try {
    const result = await generateMusic(body.prompt);
    trackEvent("default", "feature_used", { feature: "music_gen" });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Music generation failed" }, { status: 503 });
  }
}
