// POST /api/v1/chat — public API chat endpoint (developer platform).
//
// This is the API-key-authenticated counterpart to /api/chat. It accepts
// the same request body { conversationId?, message } and returns the
// same SSE token stream — but authenticates via `Bearer qaesitor_...`
// instead of Basic auth. This is the entry point programmatic clients
// (SDKs, integrations, browser extensions) use to embed Quaesitor chat
// in their own products.
//
// Why a separate route (not a flag on /api/chat)?
//   1. Versioning — /api/v1/* is the public API surface. Breaking
//      changes to /api/chat (e.g. adding a required field) must NOT
//      break programmatic clients. The v1 namespace freezes the
//      request/response shape.
//   2. Auth isolation — `requireApiKey` is the ONLY auth gate here.
//      Mixing API-key and Basic-auth on the same route would make the
//      auth matrix ambiguous (does X-MFA-Token apply to API keys?).
//   3. Rate limit policy — programmatic clients tend to drive much
//      higher QPS than a single user in the dashboard. Having a
//      separate route lets us apply a stricter rate limit (or a
//      per-key quota) without touching the dashboard route.
//
// Usage tracking: every call is recorded via `recordUsage()` so the
// Stripe metered-billing flusher can report it to Stripe (if the user
// is on a metered plan). This is the "metered" part of metered billing
// — see src/lib/usage-tracker.ts.

import { NextRequest } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { getLLM, getProviderDisplayInfo, type LLMMessage } from "@/lib/llm-provider";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { checkLimit as checkPlanLimit } from "@/lib/plan-limits";
import { QUAESITOR_CHARACTER } from "@/lib/prompts/claude-character";
import {
  getOrCreateConversation,
  saveMessage,
  getHistory,
  type ChatMessage,
} from "@/lib/chat-store";
import { requireApiKey } from "@/lib/auth";
import { sanitizeError } from "@/lib/sanitize-error";
import { recordUsage } from "@/lib/usage-tracker";

const MAX_HISTORY = 20;

export async function POST(req: NextRequest) {
  // API-key auth (NOT Basic auth — this is the public API surface).
  const apiAuth = requireApiKey(req);
  if (apiAuth instanceof Response) return apiAuth;
  // `requireApiKey` returns either `{ userId }` or a `NextResponse`.
  // The `instanceof Response` check above narrows the union — at this
  // point apiAuth is `{ userId }`.
  const userId = apiAuth.userId;

  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawMessage = (body.message || "").trim();
  if (!rawMessage) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  // Prompt injection defense — same gate as the dashboard route.
  const injectionCheck = sanitizeQuery(rawMessage);
  if (injectionCheck.blocked) {
    return Response.json(
      { error: "Request blocked: potential prompt injection detected." },
      { status: 400 }
    );
  }
  const message = sanitizeInput(injectionCheck.sanitized);

  // Plan limit enforcement. Programmatic clients tend to drive higher
  // QPS than the dashboard UI, so the 402 surface matters more here —
  // the SDK should surface this as a typed error so integrators can
  // prompt their end users to upgrade.
  const planCheck = checkPlanLimit(userId, "chat");
  if (!planCheck.allowed) {
    return Response.json(
      {
        ok: false,
        error:
          "Your plan's monthly chat limit has been reached. Upgrade at /pricing to continue.",
        plan: planCheck.plan,
        limit: planCheck.limit,
        remaining: planCheck.remaining,
      },
      { status: 402 }
    );
  }

  // Explicit LLM provider check — return 503 BEFORE starting the stream.
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOllama = !!process.env.OLLAMA_URL;
  if (!hasNvidia && !hasOpenai && !hasAnthropic && !hasOllama) {
    return Response.json(
      {
        ok: false,
        error:
          "No LLM provider configured. Set NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_URL.",
      },
      { status: 503 }
    );
  }

  const conversationId = await getOrCreateConversation(
    body.conversationId || null,
    userId,
    message
  );

  await saveMessage(conversationId, "user", message);
  trackEvent(userId, "api_v1_chat_message_sent", {
    conversationId,
    messageLength: message.length,
  });

  // Record usage for metered billing (P1 feature). The record is
  // buffered in the usage_records table; the flusher in
  // usage-tracker.ts reports it to Stripe every 60 seconds if the
  // user is on a metered plan. Failures are swallowed — billing is
  // best-effort and must NOT block the chat response.
  recordUsage(userId, "chat");

  const history = await getHistory(conversationId);

  // The v1 API uses the same character prompt as the dashboard so
  // responses are consistent across surfaces. Memory recall is
  // intentionally NOT wired up here — the v1 API is a low-level
  // primitive for integrators, and silently injecting recalled
  // memories into a programmatic request would be surprising.
  const systemPrompt = QUAESITOR_CHARACTER;

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY - 1, -1).map((m: ChatMessage) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const llm = await getLLM();
  const encoder = new TextEncoder();

  const expectedDisplay = getProviderDisplayInfo(llm.provider);
  const expectedModel = llm.smartModels[0] || "unknown";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Provider transparency meta event (same shape as /api/chat so
      // SDKs that already parse that stream work unchanged).
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "meta",
            provider: llm.provider,
            providerDisplayName: expectedDisplay.displayName,
            region: expectedDisplay.region,
            model: expectedModel,
            expected: true,
          })}\n\n`
        )
      );
      try {
        const result = await llm.smart({
          messages: llmMessages,
          maxTokens: 2000,
          temperature: 0.4,
          stream: true,
          onToken: (token: string) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          },
        });

        await saveMessage(
          conversationId,
          "assistant",
          result.content,
          result.tokensUsed,
          result.model
        );

        const actualDisplay = getProviderDisplayInfo(result.provider);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              conversationId,
              tokensUsed: result.tokensUsed,
              provider: result.provider,
              providerDisplayName: actualDisplay.displayName,
              region: actualDisplay.region,
              model: result.model,
            })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        // P0-10: sanitize the error before sending to the client.
        const msg = sanitizeError(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
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
