import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateVideo } from "@/lib/multi-modal/generators";
import { trackEvent } from "@/lib/analytics";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  let body: { prompt?: string; options?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ ok: false, error: "Prompt required" }, { status: 400 });
  try {
    const result = await generateVideo(body.prompt);
    trackEvent("default", "feature_used", { feature: "video_gen" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Video generation failed" }, { status: 503 });
  }
}
