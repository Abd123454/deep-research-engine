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
// Rate-limit imports — apply the same start-rate gate as /api/research/start
// so a single API key can't DoS the chat endpoint with unbounded QPS.
// `checkStartRateLimit` enforces max 5 starts/min + 3 concurrent + 50/day per
// client IP; `releaseConcurrency` MUST be called when the stream completes
// (success or error) so the concurrent slot doesn't leak.
import { checkStartRateLimit, releaseConcurrency, getClientIP } from "@/lib/rate-limit";

const MAX_HISTORY = 20;

export async function POST(req: NextRequest) {
  // API-key auth (NOT Basic auth — this is the public API surface).
  const apiAuth = requireApiKey(req);
  if (apiAuth instanceof Response) return apiAuth;
  // `requireApiKey` returns either `{ userId }` or a `NextResponse`.
  // The `instanceof Response` check above narrows the union — at this
  // point apiAuth is `{ userId }`.
  const userId = apiAuth.userId;

  // Client IP is resolved up-front because it's needed both for the
  // rate-limit gate (below, just before the stream starts) and for the
  // releaseConcurrency call in the stream's finally block.
  const clientIP = getClientIP(req);

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

  // Rate-limit: applied as the LAST gate before the stream starts so the
  // cheap validation paths (400/402/503 above) don't acquire a concurrency
  // slot they'd then have to release. The 429 response includes Retry-After
  // so well-behaved SDKs can back off gracefully. The concurrency slot is
  // released in the stream's `finally` below — see the comment there for
  // why a leak there would permanently exhaust the per-IP budget.
  const rateLimit = await checkStartRateLimit(clientIP);
  if (!rateLimit.ok) {
    return Response.json(
      { ok: false, error: rateLimit.reason },
      {
        status: 429,
        headers: rateLimit.retryAfterSec
          ? { "Retry-After": String(rateLimit.retryAfterSec) }
          : undefined,
      }
    );
  }

  // ---------- Pre-stream setup ----------
  // These calls run AFTER the rate-limit slot is acquired but BEFORE the
  // stream's `finally` is wired up. If any of them throws (DB locked, LLM
  // provider init failure, etc.), the slot would leak. We wrap them in a
  // try-catch that releases the slot on error so the per-IP concurrent
  // budget can never be permanently exhausted by a transient setup error.
  let conversationId: string;
  let llmMessages: LLMMessage[];
  let llm: Awaited<ReturnType<typeof getLLM>>;
  let expectedDisplay: ReturnType<typeof getProviderDisplayInfo>;
  let expectedModel: string;
  const encoder = new TextEncoder();
  try {
    conversationId = await getOrCreateConversation(
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
    // usage-tracker.ts reports it to Stripe every 60 seconds if the user
    // is on a metered plan. Failures are swallowed — billing is
    // best-effort and must NOT block the chat response.
    recordUsage(userId, "chat");

    const history = await getHistory(conversationId);

    // The v1 API uses the same character prompt as the dashboard so
    // responses are consistent across surfaces. Memory recall is
    // intentionally NOT wired up here — the v1 API is a low-level
    // primitive for integrators, and silently injecting recalled
    // memories into a programmatic request would be surprising.
    const systemPrompt = QUAESITOR_CHARACTER;

    llmMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-MAX_HISTORY - 1, -1).map((m: ChatMessage) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    llm = await getLLM();
    expectedDisplay = getProviderDisplayInfo(llm.provider);
    expectedModel = llm.smartModels[0] || "unknown";
  } catch (err) {
    // Pre-stream setup failed — release the rate-limit slot before
    // returning the error so the per-IP concurrent budget isn't leaked.
    releaseConcurrency(clientIP);
    const msg = sanitizeError(err);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }

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
      } finally {
        // Release the rate-limit concurrency slot whether the stream
        // succeeded or failed. Without this, a single client that opens
        // 3 streams and lets them hang would permanently exhaust the
        // per-IP concurrent budget (MAX_CONCURRENT=3 in rate-limit.ts),
        // blocking ALL further chat requests from that IP until the
        // process restarts. The release is idempotent (decrement stops
        // at 0 — see releaseConcurrency in rate-limit.ts).
        releaseConcurrency(clientIP);
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
