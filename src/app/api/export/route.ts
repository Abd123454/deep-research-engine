// POST /api/export — convert markdown to PDF / DOCX / MD and return as download.
//
// Body: { content: string (markdown), format: "pdf" | "docx" | "md", filename?: string }
// Returns: binary file with appropriate Content-Type and Content-Disposition.

import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { exportReport, isSupportedFormat } from "@/lib/export";
import { requireAuth } from "@/lib/auth";

const MAX_CONTENT_CHARS = 500_000; // 500K chars ≈ a very long report

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  let body: { content?: string; format?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const content = (body.content || "").trim();
  if (!content) {
    return Response.json({ error: "Content is required." }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return Response.json(
      { error: `Content exceeds ${MAX_CONTENT_CHARS} character limit.` },
      { status: 413 }
    );
  }

  const format = body.format || "";
  if (!isSupportedFormat(format)) {
    return Response.json(
      { error: `Unsupported format: ${format}. Use 'pdf', 'docx', or 'md'.` },
      { status: 400 }
    );
  }

  try {
    const result = await exportReport({
      content,
      format,
      filename: body.filename,
    });
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.buffer.length),
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return Response.json(
      { error: "Export failed." },
      { status: 500 }
    );
  }
}
