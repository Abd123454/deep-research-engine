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
import { getLLM, type LLMMessage } from "@/lib/llm-provider";
import { recallRelevantMemories, injectMemoriesIntoPrompt } from "@/lib/memory-recall";
import { extractAndStoreMemories } from "@/lib/memory-extractor";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import type { MessageRow } from "@/lib/sqlite-types";

const MAX_HISTORY = 20;
const DEFAULT_USER_ID = "default";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

async function getOrCreateConversation(conversationId: string | null, userId: string, firstMessage: string): Promise<string> {
  if (conversationId) return conversationId;

  const id = crypto.randomUUID();
  const title = firstMessage.slice(0, 50);

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const conv = await prisma.conversation.create({
          data: { id, userId, title },
        });
        return conv.id;
      }
    } catch { /* fall through */ }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, userId, title);
  } catch { /* ignore */ }
  return id;
}

async function saveMessage(conversationId: string, role: string, content: string, tokensUsed?: number, modelUsed?: string): Promise<void> {
  const id = crypto.randomUUID();
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.message.create({
          data: { id, conversationId, role, content, tokensUsed: tokensUsed || 0, modelUsed },
        });
        return;
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO messages (id, conversation_id, role, content, tokens_used, model_used) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, conversationId, role, content, tokensUsed || 0, modelUsed || null
    );
  } catch { /* ignore */ }
}

async function getHistory(conversationId: string): Promise<ChatMessage[]> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
          take: MAX_HISTORY,
        });
        return messages.map((m) => ({
          id: m.id, role: m.role, content: m.content,
          createdAt: m.createdAt?.toISOString?.() || String(m.createdAt),
        }));
      }
    } catch { /* fall through */ }
  }
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?").all(conversationId, MAX_HISTORY) as MessageRow[];
    return rows.map((r) => ({
      id: r.id, role: r.role, content: r.content, createdAt: r.created_at,
    }));
  } catch { return []; }
}

function buildChatSystemPrompt(history: ChatMessage[], memories: Awaited<ReturnType<typeof recallRelevantMemories>>): string {
  let prompt = "You are a helpful, knowledgeable AI assistant. You're having a conversation with the user. Be concise but thorough. Use markdown formatting when helpful.";

  if (memories.length > 0) {
    prompt = injectMemoriesIntoPrompt(prompt, memories);
  }

  return prompt;
}

export async function POST(req: NextRequest) {
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

  const userId = DEFAULT_USER_ID;

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId, tokensUsed: result.tokensUsed })}\n\n`
          )
        );
        controller.close();

        // Non-blocking: extract memories.
        extractAndStoreMemories(userId, `user: ${message}\nassistant: ${result.content}`).catch(() => {});
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
