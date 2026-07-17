import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/multi-modal/generators";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  let body: { prompt?: string; options?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  try {
    const result = await generateImage(body.prompt, body.options || {});
    trackEvent("default", "feature_used", { feature: "image_gen", model: result.model });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 503 });
  }
}
