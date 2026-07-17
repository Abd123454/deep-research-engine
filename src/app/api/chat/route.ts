// POST /api/chat — conversational chat with streaming + memory injection.
//
// Body: { conversationId?: string, message: string }
// Response: SSE stream of tokens, then { done, conversationId, tokensUsed }.
//
// Flow:
// 1. Get or create conversation (Postgres or SQLite)
// 2. Save user message
// 3. Get conversation history (last 20 messages)
// 4. Recall relevant memories (semantic search)
// 5. Build system prompt with memories + context
// 6. Stream LLM response
// 7. Save assistant message
// 8. Non-blocking: extract memories

import { NextRequest } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { getLLM, getProviderDisplayInfo, type LLMMessage } from "@/lib/llm-provider";
import { recallRelevantMemories, injectMemoriesIntoPrompt } from "@/lib/memory-recall";
import { extractAndStoreMemories, detectMemoryCommand, isMemoryExtractionEnabled, storeExplicitMemory } from "@/lib/memory-extractor";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { checkLimit as checkPlanLimit } from "@/lib/plan-limits";
import { QUAESITOR_CHARACTER } from "@/lib/prompts/claude-character";
import {
  getOrCreateConversation,
  saveMessage,
  getHistory,
  type ChatMessage,
} from "@/lib/chat-store";
import { requireAuth, getUserId } from "@/lib/auth";

const MAX_HISTORY = 20;

function buildChatSystemPrompt(history: ChatMessage[], memories: Awaited<ReturnType<typeof recallRelevantMemories>>): string {
  let prompt = QUAESITOR_CHARACTER;

  if (memories.length > 0) {
    prompt = injectMemoriesIntoPrompt(prompt, memories);
  }

  return prompt;
}

export async function POST(req: NextRequest) {
  // Auth: require valid credentials. Per-user isolation (no more DEFAULT_USER_ID).
  const authError = requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

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

  // Prompt injection defense: scan the message for injection patterns.
  // Blocks critical patterns (e.g. "ignore previous instructions") and
  // multiple suspicious patterns.
  const injectionCheck = sanitizeQuery(rawMessage);
  if (injectionCheck.blocked) {
    return Response.json({ error: "Request blocked: potential prompt injection detected." }, { status: 400 });
  }
  const message = sanitizeInput(injectionCheck.sanitized);

  // Rate limit.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) {
    return Response.json({ error: rl.reason }, { status: 429 });
  }

  // ---------- Plan limit enforcement (402 Payment Required) ----------
  // Free plan: 500 chat messages/month — generous enough that no test or
  // fresh dev deployment trips the gate. Returns the plan + remaining so
  // the UI can surface a graceful upgrade prompt.
  const planCheck = checkPlanLimit(userId, "chat");
  if (!planCheck.allowed) {
    return Response.json(
      {
        ok: false,
        error:
          "Your plan's monthly chat limit has been reached. Upgrade at /pricing to continue the conversation.",
        plan: planCheck.plan,
        limit: planCheck.limit,
        remaining: planCheck.remaining,
      },
      { status: 402 }
    );
  }

  // Explicit LLM provider check — return 503 BEFORE starting the stream.
  // getLLM() is lazy and won't throw until smart() is called inside the
  // stream, which would return 200 + error-in-stream. This explicit check
  // prevents that.
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

  const conversationId = await getOrCreateConversation(body.conversationId || null, userId, message);

  // Save user message.
  await saveMessage(conversationId, "user", message);
  trackEvent(userId, "chat_message_sent", { conversationId, messageLength: message.length });

  // Get conversation history.
  const history = await getHistory(conversationId);

  // Recall relevant memories.
  const memories = await recallRelevantMemories(userId, message, 5);

  // Build system prompt.
  const systemPrompt = buildChatSystemPrompt(history, memories);

  // Build LLM messages: system + history (excluding the just-saved user message) + current message.
  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY - 1, -1).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const llm = await getLLM();
  const encoder = new TextEncoder();

  // Provider transparency: emit a `meta` event BEFORE the first token so
  // the UI can display "Quaesitor · <model> via <Provider> (<region>)".
  // This uses the EXPECTED provider + first smart model — if fallback
  // kicks in mid-stream, the actual provider/model is included in the
  // final `done` event (see below) and the UI updates accordingly.
  const expectedDisplay = getProviderDisplayInfo(llm.provider);
  const expectedModel = llm.smartModels[0] || "unknown";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Emit meta first — clients ignore unknown event types so existing
      // parsers (e.g. older ChatCard builds) keep working.
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          },
        });

        // Save assistant message.
        await saveMessage(conversationId, "assistant", result.content, result.tokensUsed, result.model);

        // Build the actual provider display info from the result — this
        // may differ from the expected meta if cross-provider fallback
        // (NVIDIA → OpenAI → Anthropic → Ollama) kicked in. The UI uses
        // this to correct the displayed provider after streaming ends.
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

        // Non-blocking: extract memories.
        //
        // Memory consent gate (Ethical #4): automatic extraction only runs
        // when the user has explicitly opted in via /api/preferences/memory.
        // Default is FALSE (opt-in, not opt-out).
        //
        // Exception (Ethical #5): if the user's message started with an
        // explicit memory command ("remember that...", "تذكر أن..."), store
        // the captured content directly. The user's explicit ask counts as
        // consent for that one memory, regardless of the global opt-in.
        const memoryCmd = detectMemoryCommand(message);
        if (memoryCmd.isMemoryCommand && memoryCmd.content) {
          storeExplicitMemory(userId, memoryCmd.content).catch(() => {});
        } else if (isMemoryExtractionEnabled(userId)) {
          extractAndStoreMemories(userId, `user: ${message}\nassistant: ${result.content}`).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      } finally {
        releaseConcurrency(ip);
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
