// Quick mode — single LLM call with streaming (no research pipeline).
// POST /api/modes/quick
// Body: { message: string }
// Returns: SSE stream of tokens from NVIDIA LLM.

import { getLLM, type LLMMessage } from "@/lib/llm-provider";
import { checkStartRateLimit, releaseConcurrency, getClientIP } from "@/lib/rate-limit";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { QUAESITOR_CHARACTER } from "@/lib/prompts/claude-character";
import { requireAuth } from "@/lib/auth";
import { NextRequest } from "next/server";

const MAX_MESSAGE_CHARS = 10_000;

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // Rate limit — same limiter as research, to prevent abuse.
  // H-3: use getClientIP() instead of reading X-Forwarded-For directly.
  const ip = getClientIP(req);
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) {
    return Response.json(
      { error: rl.reason },
      { status: 429 }
    );
  }

  let body: { message?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Accept both "message" and "query" fields for flexibility.
  const rawMessage = (body.message || body.query || "").trim();
  if (!rawMessage) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }
  if (rawMessage.length > MAX_MESSAGE_CHARS) {
    return Response.json(
      { error: `Message exceeds ${MAX_MESSAGE_CHARS} character limit` },
      { status: 400 }
    );
  }

  // Prompt injection defense.
  const injectionCheck = sanitizeQuery(rawMessage);
  if (injectionCheck.blocked) {
    return Response.json({ error: "Request blocked: potential prompt injection detected." }, { status: 400 });
  }
  const message = sanitizeInput(injectionCheck.sanitized);

  // Explicit LLM provider check — return 503 BEFORE starting the stream.
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOllama = !!process.env.OLLAMA_URL;
  if (!hasNvidia && !hasOpenai && !hasAnthropic && !hasOllama) {
    return Response.json(
      { ok: false, error: "No LLM provider configured. Set NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_URL." },
      { status: 503 }
    );
  }

  const llm = await getLLM();

  const sys: LLMMessage = {
    role: "system",
    content: QUAESITOR_CHARACTER,
  };
  const user: LLMMessage = { role: "user", content: message };

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await llm.smart({
          messages: [sys, user],
          maxTokens: 2000,
          temperature: 0.4,
          stream: true,
          onToken: (token: string) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          },
        });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, tokensUsed: result.tokensUsed })}\n\n`
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
      } finally {
        releaseConcurrency(ip);
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
