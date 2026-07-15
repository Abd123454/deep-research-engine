// POST /api/chat/agent — ReAct (Reason + Act) chat with tool use.

import { NextRequest } from "next/server";
import { getLLM, type LLMMessage } from "@/lib/llm-provider";
import { getSkill } from "@/lib/skills";
import { detectToolCall, executeToolCall, getToolsDescription } from "@/lib/agent-tools";
import { recallRelevantMemories, injectMemoriesIntoPrompt } from "@/lib/memory-recall";
import { extractAndStoreMemories } from "@/lib/memory-extractor";
import { getDb } from "@/lib/db";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";

const MAX_HISTORY = 20;
const MAX_TOOL_ITERATIONS = 5;
const DEFAULT_USER_ID = "default";

async function getOrCreateConversation(conversationId: string | null, userId: string, firstMessage: string): Promise<string> {
  if (conversationId) return conversationId;
  const id = crypto.randomUUID();
  const title = firstMessage.slice(0, 50);
  try {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run(id, userId, title);
  } catch { /* ignore */ }
  return id;
}

async function saveMessage(conversationId: string, role: string, content: string): Promise<void> {
  const id = crypto.randomUUID();
  try {
    const db = getDb();
    db.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)").run(id, conversationId, role, content);
  } catch { /* ignore */ }
}

async function getHistory(conversationId: string): Promise<{ role: string; content: string }[]> {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?").all(conversationId, MAX_HISTORY) as any[];
    return rows.map((r) => ({ role: r.role, content: r.content }));
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; message?: string; skill?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) return Response.json({ error: "Message is required." }, { status: 400 });

  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOllama = !!process.env.OLLAMA_URL;
  if (!hasNvidia && !hasOpenai && !hasAnthropic && !hasOllama) {
    return Response.json({ ok: false, error: "No LLM provider configured." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) return Response.json({ error: rl.reason }, { status: 429 });

  const skill = getSkill(body.skill || "default");
  const userId = DEFAULT_USER_ID;
  const conversationId = await getOrCreateConversation(body.conversationId || null, userId, message);

  await saveMessage(conversationId, "user", message);
  const history = await getHistory(conversationId);
  const memories = await recallRelevantMemories(userId, message, 5);

  let systemPrompt = skill.systemPrompt;
  if (skill.allowedTools.length > 0) {
    systemPrompt += "\n\n" + getToolsDescription();
  }
  if (memories.length > 0) {
    systemPrompt = injectMemoriesIntoPrompt(systemPrompt, memories);
  }

  const llm = await getLLM();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let currentMessage = message;
        let iteration = 0;
        let fullResponse = "";

        while (iteration < MAX_TOOL_ITERATIONS) {
          iteration++;
          const llmMessages: LLMMessage[] = [
            { role: "system", content: systemPrompt },
            ...history.slice(-MAX_HISTORY).map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: currentMessage },
          ];

          let iterationResponse = "";
          const result = await llm.smart({
            messages: llmMessages,
            maxTokens: 2000,
            temperature: 0.4,
            stream: true,
            onToken: (token: string) => {
              iterationResponse += token;
              send({ token });
            },
          });

          fullResponse += result.content;
          const toolCall = detectToolCall(result.content);

          if (!toolCall || !skill.allowedTools.includes(toolCall.tool)) break;

          send({ tool_call: { tool: toolCall.tool, params: toolCall.params } });
          const toolResult = await executeToolCall(toolCall);
          send({ tool_result: { tool: toolResult.tool, success: toolResult.success, output: toolResult.output.slice(0, 2000) } });

          currentMessage = `Tool "${toolResult.tool}" returned:\n${toolResult.output}`;
          history.push({ role: "assistant", content: result.content });
          history.push({ role: "user", content: currentMessage });
        }

        await saveMessage(conversationId, "assistant", fullResponse);
        send({ done: true, conversationId, tokensUsed: 0 });
        controller.close();
        extractAndStoreMemories(userId, `user: ${message}\nassistant: ${fullResponse}`).catch(() => {});
      } catch (err) {
        send({ error: err instanceof Error ? err.message : String(err) });
        controller.close();
      } finally {
        releaseConcurrency(ip);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
