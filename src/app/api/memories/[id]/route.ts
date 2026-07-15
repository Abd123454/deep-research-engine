// DELETE /api/memories/[id] — delete a memory.

import { NextRequest } from "next/server";
import { deleteMemory } from "@/lib/memory-extractor";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteMemory(id);
  if (!deleted) {
    return Response.json({ ok: false, error: "Memory not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
