// GET    /api/documents/[id] — get full document.
// DELETE /api/documents/[id] — delete document.

import { NextRequest } from "next/server";
import { getDocument, deleteDocument } from "@/lib/document-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteDocument(id);
  if (!deleted) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
