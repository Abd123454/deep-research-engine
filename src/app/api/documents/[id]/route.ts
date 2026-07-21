// GET    /api/documents/[id] — get full document.
// DELETE /api/documents/[id] — delete document.

import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getDocument, deleteDocument } from "@/lib/document-store";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const { id } = await params;
    const doc = getDocument(id);
    if (!doc) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    return Response.json({
      ok: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        text: doc.text,
        textLength: doc.textLength,
        preview: doc.preview,
        uploadedAt: doc.uploadedAt,
      },
    });
  } catch (err) {
    // FB-3 fix: params resolution or store lookup can throw. Wrap to
    // avoid a raw 500 with stack trace.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "documents", err: safe }, "document get failed");
    return Response.json(
      { ok: false, error: safe || "Failed to retrieve document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const { id } = await params;
    const deleted = deleteDocument(id);
    if (!deleted) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    // FB-3 fix: same defensive wrap as GET above.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "documents", err: safe }, "document delete failed");
    return Response.json(
      { ok: false, error: safe || "Failed to delete document." },
      { status: 500 }
    );
  }
}
