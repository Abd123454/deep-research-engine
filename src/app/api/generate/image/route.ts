import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateImage } from "@/lib/multi-modal/generators";
import { trackEvent } from "@/lib/analytics";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  let body: { prompt?: string; options?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ ok: false, error: "Prompt required" }, { status: 400 });
  try {
    const result = await generateImage(body.prompt, body.options || {});
    trackEvent("default", "feature_used", { feature: "image_gen", model: result.model });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    // Capture full error for observability; return a generic message
    // to avoid leaking downstream provider details (URL, headers, etc.).
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Image generation failed" }, { status: 503 });
  }
}
