// GET /api/documents — list all uploaded documents.

import { listDocuments } from "@/lib/document-store";

export async function GET() {
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
