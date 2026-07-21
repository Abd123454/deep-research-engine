// POST /api/documents/upload — multipart/form-data document upload.
//
// Accepts a single file under the `file` field, extracts its text via
// `parseDocument` (PDF / DOCX / TXT / MD / image-OCR), stores the result
// in the in-memory document store, and returns the new document id +
// text length + preview.
//
// Frontend callers (both DocumentCard.tsx and DocumentsMode.tsx) POST
// to this exact path. This route was previously missing (FB-1, CVSS 8.5)
// — the frontend hit a 404 on every document upload, breaking the entire
// document-Q&A feature.
//
// Limits:
//   - Max file size: 25 MB (enforced before parsing to bound memory)
//   - Max docs per IP: 10 (enforced in document-store.addDocument)
//   - Allowed MIME types: see ALLOWED_MIME_TYPES in document-parser.ts
//
// Auth: requireAuth (respects AUTH_DEV_BYPASS=1 for local dev).

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { parseDocument, isAllowedMimeType, ALLOWED_MIME_TYPES } from "@/lib/document-parser";
import { addDocument } from "@/lib/document-store";
import { requireAuth, getUserId } from "@/lib/auth";
import { getClientIP } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  // Auth gate.
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  try {
    // parse multipart/form-data. Next.js 16 Request extends Web Fetch
    // Request, so `req.formData()` works natively for multipart bodies.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid multipart/form-data body." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file provided. Attach a file under the 'file' field." },
        { status: 400 }
      );
    }

    // MIME type validation (defensive — the browser sends this, but we
    // must not trust it blindly. We validate against an allowlist and
    // also let parseDocument reject unknown types at extraction time).
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 415 }
      );
    }

    // Size validation (before reading the whole buffer into memory).
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 413 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "File is empty." },
        { status: 400 }
      );
    }

    // Read the file into a Buffer for the parser.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text (PDF / DOCX / TXT / MD / image-OCR).
    const parsed = await parseDocument(buffer, mimeType);

    // Store the document (enforces per-IP + global caps).
    const clientIP = getClientIP(req);
    const result = addDocument(
      clientIP,
      file.name,
      mimeType,
      file.size,
      parsed.text,
      parsed.textLength,
      parsed.preview
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: 429 }
      );
    }

    logger.info(
      { module: "documents", userId, docId: result.document.id, filename: file.name, size: file.size, textLength: parsed.textLength },
      "document uploaded"
    );

    return NextResponse.json({
      ok: true,
      documentId: result.document.id,
      filename: result.document.filename,
      textLength: result.document.textLength,
      preview: result.document.preview,
      mimeType: result.document.mimeType,
      size: result.document.size,
    });
  } catch (err) {
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error(
      { module: "documents", userId, err: safe },
      "document upload failed"
    );
    // Return the parser's specific message (e.g. "PDF contained no
    // extractable text") so the user knows what to fix — these are
    // user-facing validation errors, not internal leaks.
    return NextResponse.json(
      { ok: false, error: safe || "Upload failed." },
      { status: 500 }
    );
  }
}
