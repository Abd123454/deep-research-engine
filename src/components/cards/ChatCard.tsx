"use client";
import * as Sentry from "@sentry/nextjs";

// ChatCard — multi-turn conversational chat with Claude-exact message structure.
// User messages: right-aligned warm gray bubble, serif font.
// Assistant messages: NO bubble, full-width serif prose on cream bg.

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Square, Copy, Check, Leaf, Lightbulb, PanelRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
// P0-5: streaming artifact detection. During the stream we run
// `detectArtifactStream` (throttled to 200ms) on the partial response.
// If an opening marker is detected, an "Artifact detected →" button
// appears in the assistant message footer; clicking it calls
// `onArtifact` with the partial artifact so the parent can open the
// ArtifactsPanel. On stream completion, the canonical `detectArtifact`
// pass runs and `onArtifact` is called with the final version.
import {
  detectArtifact as detectArtifactFinal,
  detectArtifactStream,
  type Artifact,
} from "@/lib/artifact-detector";
// P0-8: inline citation hover cards. The parseCitations helper splits a
// text node into strings + <CitationHoverCard> elements based on [N]
// patterns. When no `sources` array is provided (chat transcripts don't
// currently carry source metadata), CitationHoverCard renders the plain
// `[N]` text — visually identical to the pre-existing behavior.
import {
  parseCitations,
  type CitationSource,
} from "@/components/CitationHoverCard";

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
  /** Called when an artifact is detected (streaming or final). */
  onArtifact?: (a: Artifact | null) => void;
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

  // P0-5: when the stream completes, run the canonical `detectArtifact`
  // pass and clear the partial. If a final artifact is found, notify the
  // parent (which opens the ArtifactsPanel). If none is found but a
  // partial was visible, notify with `null` so the parent can close it.
  React.useEffect(() => {
    if (streaming) return;
    if (!streamingResponse && messages.length === 0) return;
    // Use the last assistant message (the one that just finished) as
    // the input — `streamingResponse` has been cleared by this point.
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const text = lastAssistant?.content || "";
    if (!text) {
      setStreamArtifact(null);
      return;
    }
    const finalArtifact = detectArtifactFinal(text);
    setStreamArtifact(null);
    if (onArtifact) onArtifact(finalArtifact);
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
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullResponse || (streamingResponse || "(empty response)") },
          ]);
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

  // P0-8: walk markdown children, replacing [N] patterns in string
  // children with <CitationHoverCard> elements. When `sources` is
  // absent (chat API doesn't currently send source metadata), the
  // function returns children unchanged — preserving the pre-existing
  // rendering. Non-string children (elements like <strong>, <em>) are
  // passed through; only direct string children are split, which is
  // what react-markdown produces for inline text.
  //
  // The function is stable across renders: it closes over `sources`
  // (which only changes when the parent passes a new array — typically
  // never for ChatCard, since chat doesn't stream sources).
  const renderWithCitations = React.useCallback(
    (children: React.ReactNode): React.ReactNode => {
      if (!sources || sources.length === 0) return children;
      if (typeof children === "string") {
        return parseCitations(children, sources);
      }
      if (Array.isArray(children)) {
        return children.map((child, i) => {
          if (typeof child === "string") {
            return (
              <React.Fragment key={i}>
                {parseCitations(child, sources)}
              </React.Fragment>
            );
          }
          return child;
        });
      }
      return children;
    },
    [sources]
  );

  // Quaesitor markdown components — serif body, warm colors, persistent underlines
  const quaesitorMarkdownComponents: Record<string, React.ComponentType<any>> = {
    p: ({ children }: any) => <p className="mb-4">{renderWithCitations(children)}</p>,
    code: ({ inline, children }: any) =>
      inline
        ? <code className="font-mono text-[14px] bg-[#d9d4c7] dark:bg-[#322e28] px-1 py-0.5 rounded">{children}</code>
        : <pre className="font-mono text-[14px] bg-[#f4f1ea] dark:bg-[#1c1a17] p-4 rounded-lg overflow-x-auto my-4 border border-[#d9d4c7] dark:border-[#3d3830]"><code>{children}</code></pre>,
    a: ({ href, children }: any) => <a href={href} className="text-[#8b4513] underline underline-offset-2 hover:text-[#6b3410]">{children}</a>,
    h1: ({ children }: any) => <h1 className="font-body text-2xl font-semibold mt-6 mb-3 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h1>,
    h2: ({ children }: any) => <h2 className="font-body text-xl font-semibold mt-6 mb-3 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h2>,
    h3: ({ children }: any) => <h3 className="font-body text-lg font-semibold mt-4 mb-2 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h3>,
    ul: ({ children }: any) => <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="font-body text-[16px] leading-[1.7]">{renderWithCitations(children)}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-[#d9d4c7] dark:border-[#3d3830] pl-4 italic my-4 text-[#6b6358] dark:text-[#9a9080]">{children}</blockquote>,
    strong: ({ children }: any) => <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8]">{children}</strong>,
  };

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
            <div key={i} className="mb-6 group/msg">
              {/* Assistant label — "Quaesitor" + provider attribution for the latest assistant message */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
                {/* Provider transparency: only the most recent assistant
                    message gets the attribution subtitle (older history
                    isn't retroactively annotated). */}
                {i === messages.length - 1 && providerSubtitle && (
                  <span
                    className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
                    title={providerSubtitle}
                  >
                    · {providerSubtitle}
                  </span>
                )}
              </div>
              <div className="prose prose-quaesitor font-body break-words text-[#2a2620] dark:text-[#e8e3d8] max-w-none">
                <ReactMarkdown components={quaesitorMarkdownComponents}>{msg.content}</ReactMarkdown>
              </div>
              {/* Action bar — appears on hover (Quaesitor pattern).
                  On touch devices there's no hover, so the bar is
                  always visible below sm; on sm+ it fades in on hover. */}
              <div className="flex items-center gap-1 mt-2 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity">
                <button
                  onClick={() => copyMessage(i, msg.content)}
                  className="flex size-7 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
                  aria-label="Copy"
                >
                  {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-[#8b4513]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )
        ))}

        {streaming && streamingResponse && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
              {providerSubtitle && (
                <span
                  className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
                  title={providerSubtitle}
                >
                  · {providerSubtitle}
                </span>
              )}
            </div>
            <div className="prose prose-quaesitor font-body break-words text-[#2a2620] dark:text-[#e8e3d8] max-w-none">
              <ReactMarkdown components={quaesitorMarkdownComponents}>{streamingResponse}</ReactMarkdown>
              <span className="inline-block h-4 w-1.5 bg-[#8b4513] animate-pulse ml-0.5" />
            </div>
            {/* P0-5: streaming artifact affordance. While `detectArtifactStream`
                has fired (an opening marker is in the buffer), show a small
                "Artifact detected →" button. Clicking it calls `onArtifact`
                with the PARTIAL artifact so the parent can open the
                ArtifactsPanel and render a live preview as the body streams in. */}
            {streamArtifact && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onArtifact?.(streamArtifact)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#8b4513]/30 dark:border-[#b5673a]/30 bg-[#8b4513]/5 dark:bg-[#b5673a]/10 px-2 py-1 font-ui text-[11px] font-medium text-[#8b4513] dark:text-[#b5673a] hover:border-[#8b4513]/50 dark:hover:border-[#b5673a]/50 hover:bg-[#8b4513]/10 dark:hover:bg-[#b5673a]/15 transition-colors"
                  aria-label={`Open ${streamArtifact.type} artifact in side panel`}
                  title={`Open ${streamArtifact.type} artifact in side panel (partial — full content will arrive when streaming completes)`}
                >
                  <PanelRight className="h-3.5 w-3.5" />
                  Artifact detected
                  <span className="text-[#6b6358] dark:text-[#9a9080] font-normal">→</span>
                </button>
              </div>
            )}
          </div>
        )}

        {streaming && !streamingResponse && (
          <div className="mb-6">
            {/* Even before the first token, show the provider attribution if the meta event has arrived. */}
            {providerSubtitle && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
                <span
                  className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
                  title={providerSubtitle}
                >
                  · {providerSubtitle}
                </span>
              </div>
            )}
            <div className={`space-y-2 animate-pulse ${providerSubtitle ? "" : "mt-0"}`}>
              <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-3/4" />
              <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-full" />
              <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-5/6" />
            </div>
          </div>
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
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); sendFollowUp(); }}
              disabled={!followUp.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513] disabled:opacity-30 transition-colors"
              aria-label="Send"
            >
              <ArrowRight className="h-4 w-4" />
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
