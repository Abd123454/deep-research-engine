"use client";
import * as Sentry from "@sentry/nextjs";

// ChatCard — multi-turn conversational chat with Claude-exact message structure.
// User messages: right-aligned warm gray bubble, serif font.
// Assistant messages: NO bubble, full-width serif prose on cream bg.
//
// FC-3 (UI God-object split): the markdown component map, the
// AssistantMessage render block, and the StreamingMessage render block
// were extracted into ./chat/ sub-components. ChatCard now focuses on
// the conversation state machine (SSE streaming, token accumulation,
// artifact detection, follow-up send/stop) and delegates presentation
// to <AssistantMessage> / <StreamingMessage> + useChatMarkdown().

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Square, Leaf, Lightbulb } from "lucide-react";
import {
  estimateChatCarbon,
  formatCarbon,
  inferModelSize,
  type CarbonEstimate,
} from "@/lib/carbon-footprint";
import {
  getCriticalThinkingPrompt,
  shouldShowCriticalThinkingPrompt,
} from "@/lib/critical-thinking";
import {
  detectArtifact as detectArtifactFinal,
  detectArtifactStream,
  type Artifact,
} from "@/lib/artifact-detector";
import type { CitationSource } from "@/components/CitationHoverCard";
// FC-3: extracted sub-components (pure presentational).
import { useChatMarkdown, AssistantMessage, StreamingMessage } from "./chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Provider attribution shown next to the "Quaesitor" label. */
interface ProviderAttribution {
  provider: string;       // machine name (e.g. "nvidia")
  displayName: string;    // human name (e.g. "NVIDIA")
  region: string;         // e.g. "US", "local"
  model: string;          // e.g. "meta/llama-3.1-70b-instruct"
  expected?: boolean;     // true for the pre-stream meta event (may differ from actual)
}

interface ChatCardProps {
  initialMessage: string;
  conversationId?: string;
  /**
   * Called when an artifact is detected (streaming or final).
   *
   * P2-final-wave / Feature 1: the second argument `streaming` is `true`
   * while the LLM is still emitting tokens (the artifact's `content` is
   * a PARTIAL — the live, growing body) and `false` once the canonical
   * `detectArtifact` pass has run on the completed response. Parents
   * use the flag to decide whether to render the panel in "live preview"
   * mode (passing `streamingContent` to ArtifactsPanel) or in "final"
   * mode (using `artifact.content` only).
   */
  onArtifact?: (a: Artifact | null, streaming?: boolean) => void;
  /**
   * P0-8: optional source list for inline citation hover cards. When
   * provided, `[1]` / `[2]` / etc. patterns in the assistant's messages
   * become interactive hover cards (popover with title, URL, tier
   * badge, verified badge). When absent (the default — chat API doesn't
   * currently send sources), citations render as plain `[N]` text,
   * preserving the pre-existing behavior.
   */
  sources?: CitationSource[];
}

export const ChatCard = React.memo(function ChatCard({ initialMessage, conversationId: initialConvId, onArtifact, sources }: ChatCardProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { role: "user", content: initialMessage },
  ]);
  const [streamingResponse, setStreamingResponse] = React.useState("");
  const [streaming, setStreaming] = React.useState(true);
  const [conversationId, setConversationId] = React.useState(initialConvId || "");
  const [followUp, setFollowUp] = React.useState("");
  const [error, setError] = React.useState("");
  // Mirror `error` into a ref so the finally block in the streaming
  // effect can read the LATEST error value without re-subscribing the
  // effect to `error` (which would restart the fetch on every setError).
  const errorRef = React.useRef("");
  React.useEffect(() => {
    errorRef.current = error;
  }, [error]);
  const [tokens, setTokens] = React.useState(0);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  // Carbon footprint of the most recent assistant response. Updated when
  // the `done` SSE event arrives (carries tokensUsed + actual provider/model).
  const [lastCarbon, setLastCarbon] = React.useState<CarbonEstimate | null>(null);
  // Provider attribution: populated from the SSE `meta` event (expected,
  // pre-stream) and corrected by the `done` event (actual post-stream).
  const [providerInfo, setProviderInfo] = React.useState<ProviderAttribution | null>(null);
  // Critical-thinking prompt — set ONCE when the assistant's response
  // completes (not on every render, so it doesn't reshuffle). Persists
  // across follow-ups; reset only when a new response finishes.
  const [criticalThinkingPrompt, setCriticalThinkingPrompt] = React.useState<string | null>(null);
  // P0-5: partial artifact detected during streaming. While non-null, a
  // small "Artifact detected →" button is rendered below the streaming
  // response. Clicking it calls `onArtifact` with the current partial
  // (the parent opens the ArtifactsPanel). Cleared on stream completion
  // and replaced with the canonical artifact via `detectArtifact`.
  const [streamArtifact, setStreamArtifact] = React.useState<Artifact | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Throttle token for the streaming artifact check: we only run
  // `detectArtifactStream` at most once per 200ms even if tokens are
  // arriving faster. This keeps the main thread responsive on long
  // responses (the regex search is O(n) on the last 500 chars).
  const lastStreamCheckRef = React.useRef(0);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

  // P0-5: streaming artifact detection. Runs throttled (≤ once / 200ms)
  // on the latest `streamingResponse`. When an opening marker is found,
  // we set `streamArtifact` so the "Artifact detected →" button appears.
  // The check is cheap (regex on the last 500 chars) but we still throttle
  // because token batches can arrive every few ms and we don't want to
  // re-run the regex on every keystroke-equivalent.
  //
  // P2-final-wave / Feature 1: AUTO-OPEN the ArtifactsPanel. In addition
  // to setting `streamArtifact` for the inline button, we forward the
  // partial artifact to the parent via `onArtifact(streamArtifact, true)`
  // so the panel mounts immediately and starts rendering the live preview.
  // The parent tracks `streaming=true` and passes `streamingContent` to
  // ArtifactsPanel, which renders the partial as it grows — the user
  // watches the code/document fill in, like watching code being typed.
  React.useEffect(() => {
    if (!streaming || !streamingResponse) return;
    const now = Date.now();
    if (now - lastStreamCheckRef.current < 200) return;
    lastStreamCheckRef.current = now;
    const detected = detectArtifactStream(streamingResponse);
    // Only update state if the detection result CHANGED — avoids
    // re-rendering the button every 200ms when the partial content is
    // still flowing into the same artifact.
    setStreamArtifact((prev) => {
      const sameType = prev?.type === detected?.type;
      if (sameType && detected) {
        // Update the partial content in-place (the panel will re-render
        // with the longer body). No need to return a new object if the
        // content hasn't grown enough to matter — but a fresh ref keeps
        // the parent's onArtifact callback in sync if it's open.
        if (prev && prev.content === detected.content) return prev;
        return detected;
      }
      return detected;
    });
  }, [streaming, streamingResponse]);

  // P2-final-wave / Feature 1: forward the partial artifact to the parent
  // whenever it changes during streaming. This is what makes the
  // ArtifactsPanel mount + render the live preview automatically — the
  // user no longer has to click "Artifact detected →" to open the panel.
  // The button below the streaming message is kept as a manual re-open
  // affordance for when the user has dismissed the panel.
  //
  // The dependency array is intentionally just `[streamArtifact]` — we
  // don't want to re-fire on every render. `onArtifact` is captured from
  // the closure; if it changes (rare — parent's useCallback is stable),
  // the effect re-binds, which is fine.
  React.useEffect(() => {
    if (!streamArtifact) return;
    onArtifact?.(streamArtifact, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamArtifact]);

  // P0-5: when the stream completes, run the canonical `detectArtifact`
  // pass and clear the partial. If a final artifact is found, notify the
  // parent (which opens the ArtifactsPanel). If none is found but a
  // partial was visible, notify with `null` so the parent can close it.
  //
  // P2-final-wave / Feature 1: pass `streaming=false` so the parent
  // switches ArtifactsPanel out of live-preview mode and into final mode
  // (using `artifact.content` for the canonical version). If the final
  // artifact is null but a partial was visible (e.g. the user clicked
  // stop mid-code-block and `detectArtifact` couldn't match the unclosed
  // fence), fall back to the partial so the user can still see what was
  // streamed.
  React.useEffect(() => {
    if (streaming) return;
    if (!streamingResponse && messages.length === 0) return;
    // Use the last assistant message (the one that just finished) as
    // the input — `streamingResponse` has been cleared by this point.
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const text = lastAssistant?.content || "";
    if (!text) {
      setStreamArtifact(null);
      if (onArtifact) onArtifact(null, false);
      return;
    }
    const finalArtifact = detectArtifactFinal(text);
    // If no final artifact was detected but a partial was visible,
    // preserve the partial as the final (so the user can see what was
    // streamed before the response was interrupted).
    const artifactToReport = finalArtifact ?? streamArtifact ?? null;
    setStreamArtifact(null);
    if (onArtifact) onArtifact(artifactToReport, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming]);

  // Build the "Quaesitor · <model> via <Provider> (<region>)" subtitle.
  const providerSubtitle = React.useMemo(() => {
    if (!providerInfo) return null;
    return `${providerInfo.model} via ${providerInfo.displayName} (${providerInfo.region})`;
  }, [providerInfo]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = "";
    (async () => {
      setStreaming(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: initialMessage, conversationId: initialConvId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            const errorMsg = res.status === 503
              ? "No LLM provider configured. Set NVIDIA_API_KEY or another provider key."
              : res.status === 402
              ? "Plan limit reached. Upgrade at /pricing"
              : data.error || `HTTP ${res.status}`;
            setError(errorMsg);
            setStreaming(false);
          }
          return;
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6)) as {
                  type?: string; token?: string; done?: boolean; conversationId?: string;
                  tokensUsed?: number; error?: string;
                  provider?: string; providerDisplayName?: string; region?: string;
                  model?: string; expected?: boolean;
                };
                if (cancelled) return;
                // Provider transparency: meta event arrives BEFORE the first
                // token so the UI can show attribution immediately. The done
                // event carries the ACTUAL provider/model (may differ if
                // cross-provider fallback kicked in).
                if (data.type === "meta" && data.provider) {
                  setProviderInfo({
                    provider: data.provider,
                    displayName: data.providerDisplayName || data.provider,
                    region: data.region || "unknown",
                    model: data.model || "unknown",
                    expected: data.expected === true,
                  });
                }
                if (data.token) {
                  fullResponse += data.token;
                  setStreamingResponse((r) => r + data.token);
                }
                if (data.done) {
                  if (data.conversationId) setConversationId(data.conversationId);
                  if (data.tokensUsed) setTokens(data.tokensUsed);
                  // Compute carbon footprint for this response.
                  // `data.provider` is the ACTUAL provider (post-fallback).
                  // `data.model` lets us infer the model-size bucket.
                  setLastCarbon(
                    estimateChatCarbon(
                      data.tokensUsed ?? 0,
                      inferModelSize(data.model || ""),
                      data.provider === "ollama"
                    )
                  );
                  // Correct the attribution with the ACTUAL provider/model
                  // used (post-fallback). Skipped only if the meta event
                  // already matched — but it's cheaper to just overwrite.
                  if (data.provider) {
                    setProviderInfo({
                      provider: data.provider,
                      displayName: data.providerDisplayName || data.provider,
                      region: data.region || "unknown",
                      model: data.model || "unknown",
                    });
                  }
                }
                if (data.error) setError(data.error);
              } catch (err) {
                if (process.env.NODE_ENV === "production") Sentry.captureException(err);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User clicked stop — use whatever was streamed so far
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        if (!cancelled) {
          setStreaming(false);
          // P0 (UX): when the stream produced no tokens, show a helpful
          // error instead of the misleading "(empty response)". The most
          // common cause is no LLM provider configured — the /api/chat
          // route returns 503 with an `error` field, which we captured
          // into `error` state above. Surface that message so the user
          // knows exactly what to fix instead of seeing a blank reply.
          setMessages((prev) => {
            // Read the latest error from a ref-like getter to avoid stale
            // closure: error is set via setError() above; we read it from
            // the state captured at finally-time via a local variable.
            const fallbackContent =
              fullResponse ||
              streamingResponse ||
              errorRef.current ||
              "No response received. The LLM provider may not be configured — set NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_URL.";
            return [
              ...prev,
              { role: "assistant" as const, content: fallbackContent },
            ];
          });
          setStreamingResponse("");
          abortRef.current = null;
          // Critical-thinking prompt: set once when the response
          // completes. Gated by shouldShowCriticalThinkingPrompt —
          // currently returns false for "chat" so this is a no-op,
          // but the wiring is here for future tuning (e.g. showing
          // the prompt for long/complex chat responses).
          if (shouldShowCriticalThinkingPrompt("chat")) {
            setCriticalThinkingPrompt(getCriticalThinkingPrompt());
          } else {
            setCriticalThinkingPrompt(null);
          }
        }
      }
    })();
    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStreaming() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  async function sendFollowUp() {
    if (!followUp.trim() || streaming) return;
    const userMsg = followUp.trim();
    setFollowUp("");
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    setStreamingResponse("");
    // Reset provider attribution — it'll be re-populated by the meta event.
    setProviderInfo(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let fullResponse = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversationId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setStreaming(false);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as {
                type?: string; token?: string; done?: boolean; conversationId?: string;
                tokensUsed?: number; error?: string;
                provider?: string; providerDisplayName?: string; region?: string;
                model?: string; expected?: boolean;
              };
              if (data.type === "meta" && data.provider) {
                setProviderInfo({
                  provider: data.provider,
                  displayName: data.providerDisplayName || data.provider,
                  region: data.region || "unknown",
                  model: data.model || "unknown",
                  expected: data.expected === true,
                });
              }
              if (data.token) { fullResponse += data.token; setStreamingResponse((r) => r + data.token); }
              if (data.done && data.conversationId) setConversationId(data.conversationId);
              if (data.done && data.tokensUsed) setTokens((t) => t + (data.tokensUsed ?? 0));
              if (data.done) {
                // Update carbon footprint for this follow-up response.
                setLastCarbon(
                  estimateChatCarbon(
                    data.tokensUsed ?? 0,
                    inferModelSize(data.model || ""),
                    data.provider === "ollama"
                  )
                );
              }
              if (data.done && data.provider) {
                setProviderInfo({
                  provider: data.provider,
                  displayName: data.providerDisplayName || data.provider,
                  region: data.region || "unknown",
                  model: data.model || "unknown",
                });
              }
              if (data.error) setError(data.error);
            } catch (err) {
              if (process.env.NODE_ENV === "production") Sentry.captureException(err);
            }
          }
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: fullResponse || "(empty)" }]);
      setStreamingResponse("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User clicked stop — use whatever was streamed so far
        if (fullResponse) {
          setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
        }
        setStreamingResponse("");
      } else {
        setError(err instanceof Error ? err.message : "Follow-up failed");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Refresh the critical-thinking prompt for the new response
      // (same gating as the initial response — no-op for "chat" today).
      if (shouldShowCriticalThinkingPrompt("chat")) {
        setCriticalThinkingPrompt(getCriticalThinkingPrompt());
      } else {
        setCriticalThinkingPrompt(null);
      }
    }
  }

  function copyMessage(index: number, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }

  const fullConversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  void fullConversation;

  // FC-3: markdown components + citation rendering extracted to useChatMarkdown.
  // The hook returns a memoized { renderWithCitations, components } pair so
  // the markdown component map is stable across renders (important — a new
  // object on every render would defeat ReactMarkdown's memoization).
  const { components: quaesitorMarkdownComponents } = useChatMarkdown(sources);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-words"
    >
      {/* Messages — Claude structure: no card header, messages flow directly */}
      <div ref={scrollRef} className="space-y-6">
        {messages.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} className="flex flex-col items-end gap-1">
              <div className="max-w-[75%] rounded-3xl rounded-br-md bg-[#e8e0d0] dark:bg-[#322e28] px-4 py-2.5 break-words whitespace-pre-wrap font-body text-[16px] leading-[1.5] text-[#2a2620] dark:text-[#e8e3d8]">
                {msg.content}
              </div>
            </div>
          ) : (
            <AssistantMessage
              key={i}
              content={msg.content}
              providerSubtitle={providerSubtitle}
              markdownComponents={quaesitorMarkdownComponents}
              isLatest={i === messages.length - 1}
              streaming={streaming}
              conversationId={conversationId}
              index={i}
              copied={copiedIndex === i}
              onCopy={copyMessage}
            />
          )
        ))}

        {streaming && (
          <StreamingMessage
            streamingResponse={streamingResponse}
            providerSubtitle={providerSubtitle}
            markdownComponents={quaesitorMarkdownComponents}
            streamArtifact={streamArtifact}
            onArtifact={onArtifact}
          />
        )}
      </div>

      {error && (
        <div className="mt-4 py-2 text-sm text-[#a33a3a] border-t border-[#a33a3a]/20">
          {error}
        </div>
      )}

      {/* Critical-thinking prompt — shown after the assistant's response
          completes, gated by shouldShowCriticalThinkingPrompt. Currently
          a no-op for "chat" type (the gating returns false), but the
          wiring is here so future tuning (e.g. long/complex chat
          responses) can flip it on without touching ChatCard again.

          Quaesitor design: warm, italic, muted text-[#6b6358],
          Lightbulb icon. Subtle — not a callout, not a warning. */}
      {!streaming && criticalThinkingPrompt && (
        <div className="mt-4 flex items-start gap-2 px-1">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#8b4513] dark:text-[#b5673a]" aria-hidden="true" />
          <p className="text-xs italic font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed">
            <span className="font-medium not-italic">Critical thinking:</span>{" "}
            {criticalThinkingPrompt}
          </p>
        </div>
      )}

      <div className="mt-4">
        <form className="flex items-center gap-2 rounded-3xl border border-[#d9d4c7] bg-[#faf8f3] dark:border-[#3d3830] dark:bg-[#1c1a17] px-3.5 pt-3 pb-2.5 focus-within:border-[#b5673a]/50 transition-colors">
          <textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a follow-up..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 font-body text-[16px] leading-[1.5] text-[#2a2620] dark:text-[#e8e3d8] focus:outline-none placeholder:text-[#6b6358] py-1 min-h-[24px] max-h-[100px]"
            style={{ boxShadow: "none" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendFollowUp();
              }
            }}
          />
          {streaming ? (
            <button
              onClick={(e) => { e.preventDefault(); stopStreaming(); }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2a2620] dark:bg-[#e8e3d8] text-[#e8e3d8] dark:text-[#2a2620] hover:bg-[#3d3830] dark:hover:bg-[#d9d4c7] transition-colors"
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); sendFollowUp(); }}
              disabled={!followUp.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513] disabled:opacity-30 transition-colors"
              aria-label="Send"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </form>
        {tokens > 0 && (
          <p className="text-[10px] text-[#6b6358] mt-1.5 font-mono text-center">~{tokens} tokens total</p>
        )}
        {/* Carbon footprint indicator — shown after the first response completes.
            Quaesitor palette: text-[#6b6358] (faded ink), Leaf icon. */}
        {lastCarbon && (
          <div
            className="flex items-center justify-center gap-1.5 mt-1.5 text-[10px] text-[#6b6358] dark:text-[#9a9080] font-ui"
            title={
              lastCarbon.local
                ? "Local inference (Ollama) — 0g remote CO₂. See docs/ENVIRONMENTAL.md."
                : `${lastCarbon.breakdown
                    .map((b) => `${b.category}: ${b.grams}g`)
                    .join(" · ")} — see docs/ENVIRONMENTAL.md.`
            }
          >
            <Leaf className="h-3 w-3 shrink-0" />
            <span>
              {lastCarbon.local
                ? "0g CO₂ (local)"
                : `${formatCarbon(lastCarbon.grams)} estimated`}
              {" · "}
              <span className="underline-offset-2 hover:underline cursor-help">
                See impact
              </span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );

});
