// POST /api/documents/upload — multipart/form-data file upload + text extraction.
//
// Accepts: PDF, DOCX, TXT, MD, PNG, JPEG, WEBP.
// Max size: 50MB (env: MAX_DOCUMENT_SIZE_MB).
// Returns: { ok, documentId, filename, textLength, preview }.

import { NextRequest } from "next/server";
import { envInt } from "@/lib/env";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { addDocument } from "@/lib/document-store";
import { parseDocument, isAllowedMimeType } from "@/lib/document-parser";

const MAX_SIZE_MB = envInt("MAX_DOCUMENT_SIZE_MB", 50, 1, 200);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: "No 'file' field provided." },
      { status: 400 }
    );
  }

  // Size check (before rate limiting — cheap rejection).
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: `File exceeds ${MAX_SIZE_MB}MB limit (got ${(file.size / 1024 / 1024).toFixed(1)}MB).` },
      { status: 413 }
    );
  }
  if (file.size === 0) {
    return Response.json({ error: "File is empty." }, { status: 400 });
  }

  // MIME type validation — BEFORE rate limit so rejected types don't consume quota.
  const mimeType = file.type || "";
  if (!isAllowedMimeType(mimeType)) {
    return Response.json(
      { error: `Unsupported file type: ${mimeType || "unknown"}. Allowed: PDF, DOCX, TXT, MD, PNG, JPEG, WEBP.` },
      { status: 415 }
    );
  }

  // Rate limit — only after file passes validation.
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) {
    return Response.json({ error: rl.reason }, { status: 429 });
  }

  // Extract text.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let parsed;
  try {
    parsed = await parseDocument(buffer, mimeType);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to parse document." },
      { status: 422 }
    );
  }

  // Store.
  const result = addDocument(
    ip,
    file.name,
    mimeType,
    file.size,
    parsed.text,
    parsed.textLength,
    parsed.preview
  );

  releaseConcurrency(ip);

  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 429 });
  }

  return Response.json({
    ok: true,
    documentId: result.document.id,
    filename: result.document.filename,
    textLength: result.document.textLength,
    preview: result.document.preview,
  });
}
