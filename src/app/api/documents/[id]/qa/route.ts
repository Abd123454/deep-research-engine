// POST /api/documents/[id]/qa — Q&A with streaming SSE.
//
// Body: { question, mode: "qa" | "summarize" | "questions" }
// Returns: SSE stream of { token } then { done, tokensUsed }.

import { NextRequest } from "next/server";
import { getDocument } from "@/lib/document-store";
import {
  answerDocumentQuestion,
  validateQARequest,
  type QAMode,
} from "@/lib/document-qa";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { requireAuth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  let body: { question?: string; mode?: QAMode };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const validationError = validateQARequest(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  // Prompt injection defense: sanitize the question before passing to LLM.
  const rawQuestion = body.question || "";
  if (rawQuestion) {
    const injectionCheck = sanitizeQuery(rawQuestion);
    if (injectionCheck.blocked) {
      return Response.json({ error: "Request blocked: potential prompt injection detected." }, { status: 400 });
    }
    body.question = sanitizeInput(injectionCheck.sanitized);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await answerDocumentQuestion(
          doc.text,
          { question: body.question || "", mode: body.mode! },
          (token: string) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          }
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              tokensUsed: result.tokensUsed,
            })}\n\n`
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
