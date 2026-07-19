// POST /api/artifacts/stream — SSE endpoint that streams an artifact as it's generated.
//
// p2-soc2-launch / Feature 1: Streaming Artifacts. This is the future-
// facing endpoint for "Canvas Mode" — a caller submits a prompt that is
// expected to produce an artifact (HTML / React / SVG / Mermaid / code),
// and the server streams the partial artifact content as it's generated.
//
// Protocol (Server-Sent Events):
//   data: {"type":"meta","provider":"nvidia","model":"...","expected":true}\n\n
//   data: {"type":"token","token":"..."}\n\n
//   data: {"type":"partial_artifact","artifact":{"type":"html","content":"...","title":"HTML Preview"}}\n\n
//   ...
//   data: {"type":"done","artifact":{"type":"html","content":"...","title":"HTML Preview"},"tokensUsed":123}\n\n
//   data: {"type":"error","error":"sanitized message"}\n\n
//
// The "partial_artifact" events are emitted when `detectArtifactStream`
// fires mid-stream (throttled to 200ms — see `STREAM_DETECT_INTERVAL_MS`).
// Clients can render a live preview that grows as tokens arrive. On
// stream completion, the canonical `detectArtifact` runs and the final
// artifact is emitted in the `done` event.
//
// SECURITY:
//   1. requireAuth + getUserId — only authenticated users can request
//      streaming artifacts (anonymous access would be a token-spending
//      DoS vector).
//   2. Prompt-injection defense — `sanitizeQuery` runs on the input
//      before it reaches the LLM. Multi-language + Unicode-aware.
//   3. Plan-limit enforcement — Free plan has a monthly chat cap; this
//      endpoint shares the `chat` action so the cap is unified.
//   4. Rate limiting — `checkStartRateLimit` caps concurrency per IP.
//   5. Sanitized errors — downstream LLM errors (which can include
//      Authorization headers or request URLs) are passed through
//      `sanitizeError` before being emitted to the client.
//   6. No secrets in metadata — the `meta` event carries provider +
//      model only; API keys are never sent over the wire.
//
// The route runs in the nodejs runtime (not edge) because the LLM
// provider uses Node-only APIs (fetch with custom agents, etc.).

import { NextRequest } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { getLLM, getProviderDisplayInfo, type LLMMessage } from "@/lib/llm-provider";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { checkStartRateLimit, releaseConcurrency } from "@/lib/rate-limit";
import { checkLimit as checkPlanLimit } from "@/lib/plan-limits";
import { sanitizeError } from "@/lib/sanitize-error";
import {
  detectArtifact as detectArtifactFinal,
  detectArtifactStream,
  type Artifact,
} from "@/lib/artifact-detector";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Throttle for partial-artifact detection during streaming (200ms). */
const STREAM_DETECT_INTERVAL_MS = 200;

/** Cap on input prompt length — defense-in-depth against token-spend DoS. */
const MAX_PROMPT_LEN = 8000;

interface StreamArtifactsBody {
  prompt?: unknown;
  systemPrompt?: unknown;
}

/**
 * POST /api/artifacts/stream
 *
 * Body:
 *   {
 *     prompt: string,                  // the user's artifact-generation request
 *     systemPrompt?: string            // optional override of the default system prompt
 *   }
 *
 * Response: SSE stream (see file header for protocol). Always returns 200
 * with `Content-Type: text/event-stream` — errors after the stream starts
 * are emitted as `{ type: "error", error }` events so the client can
 * surface them inline (instead of a misleading 500 on an already-open SSE
 * connection).
 *
 * Pre-stream errors (auth, validation, plan limit, no provider) return
 * normal JSON error responses with the appropriate status code.
 */
export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: StreamArtifactsBody;
  try {
    body = (await req.json()) as StreamArtifactsBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const rawPrompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!rawPrompt.trim()) {
    return Response.json(
      { ok: false, error: "'prompt' is required (non-empty string)." },
      { status: 400 }
    );
  }
  if (rawPrompt.length > MAX_PROMPT_LEN) {
    return Response.json(
      {
        ok: false,
        error: `'prompt' must be ≤ ${MAX_PROMPT_LEN} chars (got ${rawPrompt.length}).`,
      },
      { status: 400 }
    );
  }

  // Prompt-injection defense — same pipeline as /api/chat. Blocks
  // "ignore previous instructions" + multi-language injection patterns.
  const injectionCheck = sanitizeQuery(rawPrompt);
  if (injectionCheck.blocked) {
    return Response.json(
      { ok: false, error: "Request blocked: potential prompt injection detected." },
      { status: 400 }
    );
  }
  const prompt = sanitizeInput(injectionCheck.sanitized);

  // Rate-limit + plan-limit (shares the `chat` action so the unified
  // monthly cap applies — artifact generation is just a special case of
  // chat completion).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) {
    return Response.json({ ok: false, error: rl.reason }, { status: 429 });
  }
  const planCheck = checkPlanLimit(userId, "chat");
  if (!planCheck.allowed) {
    return Response.json(
      {
        ok: false,
        error: "Plan limit reached. Upgrade at /pricing to continue.",
        plan: planCheck.plan,
        limit: planCheck.limit,
        remaining: planCheck.remaining,
      },
      { status: 402 }
    );
  }

  // Provider check — return 503 BEFORE opening the SSE stream so a
  // misconfigured deploy gets a clean error response instead of a
  // 200 + error-in-stream.
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

  // Default system prompt steers the model toward producing an artifact.
  // Callers can override with `body.systemPrompt` for domain-specific
  // artifact generation (e.g. "produce a D3 bar chart from this CSV").
  const defaultSystemPrompt =
    "You are Quaesitor, an AI assistant that produces self-contained artifacts " +
    "(HTML pages, React components, SVG diagrams, Mermaid diagrams, or code). " +
    "Respond with a single fenced code block — ```html, ```jsx, ```mermaid, or " +
    "```python — containing the complete artifact. Do not include prose " +
    "explanations outside the code block unless absolutely necessary.";
  const systemPrompt =
    typeof body.systemPrompt === "string" && body.systemPrompt.trim()
      ? body.systemPrompt
      : defaultSystemPrompt;

  const llm = await getLLM();
  const encoder = new TextEncoder();
  const expectedDisplay = getProviderDisplayInfo(llm.provider);
  const expectedModel = llm.smartModels[0] || "unknown";

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // Emit meta first — clients can show "Generating via <Provider>..."
      // before the first token arrives.
      send({
        type: "meta",
        provider: llm.provider,
        providerDisplayName: expectedDisplay.displayName,
        region: expectedDisplay.region,
        model: expectedModel,
        expected: true,
      });

      // Streaming artifact detection state.
      let fullResponse = "";
      let lastStreamCheck = 0;
      let lastPartialSignature: string | null = null;
      let lastEmittedPartial: Artifact | null = null;

      try {
        const result = await llm.smart({
          messages: llmMessages,
          maxTokens: 2000,
          temperature: 0.2, // low temperature — artifacts should be deterministic
          stream: true,
          onToken: (token: string) => {
            fullResponse += token;
            send({ type: "token", token });

            // Throttled partial-artifact detection. We run
            // `detectArtifactStream` at most once per 200ms — same
            // throttle the client uses in ChatCard. The detector scans
            // the last 500 chars (sliding window) so cost stays bounded
            // even on long responses.
            const now = Date.now();
            if (now - lastStreamCheck < STREAM_DETECT_INTERVAL_MS) return;
            lastStreamCheck = now;

            const partial = detectArtifactStream(fullResponse);
            if (!partial) return;

            // Only emit a partial_artifact event if the detection
            // result meaningfully changed — same type + same content
            // length bucket means the client already has it. We compare a
            // signature (type + content length bucket) to avoid spamming
            // the client with near-duplicate events on every token batch.
            const signature = `${partial.type}:${Math.floor(partial.content.length / 64)}`;
            if (signature === lastPartialSignature) {
              // Content grew within the same bucket — update the
              // in-memory partial so the next bucket boundary emits a
              // fresh event, but don't send a duplicate.
              lastEmittedPartial = partial;
              return;
            }
            lastPartialSignature = signature;
            lastEmittedPartial = partial;
            send({ type: "partial_artifact", artifact: partial });
          },
        });

        // Stream complete — run the canonical `detectArtifact` pass on
        // the full response. If it succeeds, that's the final artifact.
        // If it fails (e.g. user clicked stop mid-fence and the closing
        // ``` never arrived), fall back to the last partial so the
        // client still has something to render.
        const finalArtifact = detectArtifactFinal(result.content);
        const artifactToReport =
          finalArtifact ?? lastEmittedPartial ?? null;

        const actualDisplay = getProviderDisplayInfo(result.provider);
        send({
          type: "done",
          artifact: artifactToReport,
          tokensUsed: result.tokensUsed,
          provider: result.provider,
          providerDisplayName: actualDisplay.displayName,
          region: actualDisplay.region,
          model: result.model,
        });
        controller.close();
      } catch (err) {
        // Sanitize BEFORE sending — downstream LLM errors can leak the
        // request URL / Authorization header / connection string.
        const msg = sanitizeError(err) || "Artifact generation failed.";
        logger.warn(
          { module: "artifacts/stream", userId, err: msg },
          "Artifact stream failed"
        );
        send({ type: "error", error: msg });
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
      // Quaesitor design value: saddle brown. Set as a header for
      // debugging — clients can identify the endpoint by the X-Artifact-Stream header.
      "X-Artifact-Stream": "quaesitor",
    },
  });
}
