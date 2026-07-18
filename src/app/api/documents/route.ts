// GET /api/documents — list all uploaded documents.

import { NextRequest } from "next/server";
import { listDocuments } from "@/lib/document-store";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const docs = listDocuments().map((d) => ({
    id: d.id,
    filename: d.filename,
    mimeType: d.mimeType,
    size: d.size,
    textLength: d.textLength,
    preview: d.preview,
    uploadedAt: d.uploadedAt,
  }));
  return Response.json({ ok: true, documents: docs });
}
