import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { generateFile, type FileType } from "@/lib/file-generator";
import { requireAuth } from "@/lib/auth";

const VALID_TYPES: FileType[] = ["pdf", "docx", "pptx", "xlsx", "md"];

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const { type, title, content, userId } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ ok: false, error: `Invalid type. Use: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    if (!content || content.length > 500_000) {
      return NextResponse.json({ ok: false, error: "Content required (max 500K chars)." }, { status: 400 });
    }

  trackEvent("default", "feature_used", { feature: "file_generation" });
    const result = await generateFile({ type, title, content, userId });
    return NextResponse.json({
      ok: true,
      url: result.url,
      filename: result.filename,
      size: result.size,
      mimeType: result.mimeType,
      key: result.key,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "File generation failed." }, { status: 500 });
  }
}
