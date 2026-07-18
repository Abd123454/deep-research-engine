// POST /api/chat/agent — ReAct (Reason + Act) chat with tool use.

import { NextRequest } from "next/server";
import { getLLM, type LLMMessage } from "@/lib/llm-provider";
import { getSkillWithMarkdown } from "@/lib/skills";
import { detectToolCall, executeToolCall, getToolsDescription } from "@/lib/agent-tools";
import { recallRelevantMemories, injectMemoriesIntoPrompt } from "@/lib/memory-recall";
import { extractAndStoreMemories, detectMemoryCommand, isMemoryExtractionEnabled, storeExplicitMemory } from "@/lib/memory-extractor";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";
import {
  getOrCreateConversation,
  saveMessage,
  getHistory,
} from "@/lib/chat-store";
// P0-2 (intensive audit): import MAX_TOOL_ITERATIONS from the shared
// swarm-constants module so the agent loop and the swarm share the same
// budget. Previously this route had a local `= 5` while the swarm used
// `= 15`, causing inconsistent tool-call ceilings depending on the
// entrypoint.
import { MAX_TOOL_ITERATIONS } from "@/lib/swarm-constants";
import { sanitizeError } from "@/lib/sanitize-error";

const MAX_HISTORY = 20;
const DEFAULT_USER_ID = "default";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

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

  const skill = getSkillWithMarkdown(body.skill || "default");
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

          const result = await llm.smart({
            messages: llmMessages,
            maxTokens: 2000,
            temperature: 0.4,
            stream: true,
            onToken: (token: string) => {
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
        // Memory consent gate (Ethical #4) + explicit memory command (Ethical #5).
        // Explicit "remember that..." commands bypass the opt-in gate.
        // V3 audit fix: `isMemoryExtractionEnabled` now reads the consent
        // ledger (GDPR Art. 7) and is async — `await` it.
        const memoryCmd = detectMemoryCommand(message);
        if (memoryCmd.isMemoryCommand && memoryCmd.content) {
          storeExplicitMemory(userId, memoryCmd.content).catch(() => {});
        } else if (await isMemoryExtractionEnabled(userId)) {
          extractAndStoreMemories(userId, `user: ${message}\nassistant: ${fullResponse}`).catch(() => {});
        }
      } catch (err) {
        // P0-10: sanitize the error before sending to the client —
        // LLM provider errors can include the request URL, Authorization
        // header, or connection string, all of which contain secrets.
        send({ error: sanitizeError(err) });
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
