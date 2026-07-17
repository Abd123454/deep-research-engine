"use client";
import * as Sentry from "@sentry/nextjs";

// ChatCard — multi-turn conversational chat with Claude-exact message structure.
// User messages: right-aligned warm gray bubble, serif font.
// Assistant messages: NO bubble, full-width serif prose on cream bg.

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Square, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatCardProps {
  initialMessage: string;
  conversationId?: string;
}

export const ChatCard = React.memo(function ChatCard({ initialMessage, conversationId: initialConvId }: ChatCardProps) {
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
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

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
                  token?: string; done?: boolean; conversationId?: string;
                  tokensUsed?: number; error?: string;
                };
                if (cancelled) return;
                if (data.token) {
                  fullResponse += data.token;
                  setStreamingResponse((r) => r + data.token);
                }
                if (data.done) {
                  if (data.conversationId) setConversationId(data.conversationId);
                  if (data.tokensUsed) setTokens(data.tokensUsed);
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
                token?: string; done?: boolean; conversationId?: string;
                tokensUsed?: number; error?: string;
              };
              if (data.token) { fullResponse += data.token; setStreamingResponse((r) => r + data.token); }
              if (data.done && data.conversationId) setConversationId(data.conversationId);
              if (data.done && data.tokensUsed) setTokens((t) => t + (data.tokensUsed ?? 0));
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

  // Claude markdown components — serif, warm colors, persistent underlines
  const claudeMarkdownComponents: Record<string, React.ComponentType<any>> = {
    p: ({ children }: any) => <p className="mb-4">{children}</p>,
    code: ({ inline, children }: any) =>
      inline
        ? <code className="font-mono text-[14px] bg-[#e8e6dc] dark:bg-[#393937] px-1 py-0.5 rounded">{children}</code>
        : <pre className="font-mono text-[14px] bg-[#f0eee6] dark:bg-[#1a1a18] p-4 rounded-lg overflow-x-auto my-4 border border-[#e8e6dc] dark:border-[#3d3a35]"><code>{children}</code></pre>,
    a: ({ href, children }: any) => <a href={href} className="text-[#c96442] underline underline-offset-2 hover:text-[#b5563a]">{children}</a>,
    h1: ({ children }: any) => <h1 className="font-serif text-2xl font-semibold mt-6 mb-3 text-[#141413] dark:text-[#faf9f5]">{children}</h1>,
    h2: ({ children }: any) => <h2 className="font-serif text-xl font-semibold mt-6 mb-3 text-[#141413] dark:text-[#faf9f5]">{children}</h2>,
    h3: ({ children }: any) => <h3 className="font-serif text-lg font-semibold mt-4 mb-2 text-[#141413] dark:text-[#faf9f5]">{children}</h3>,
    ul: ({ children }: any) => <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="font-serif text-[16px] leading-[1.6]">{children}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-[#e8e6dc] dark:border-[#3d3a35] pl-4 italic my-4 text-[#5e5d59] dark:text-[#b0aea5]">{children}</blockquote>,
    strong: ({ children }: any) => <strong className="font-semibold text-[#141413] dark:text-[#faf9f5]">{children}</strong>,
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
              <div className="max-w-[80%] rounded-2xl bg-[#e8e6dc] dark:bg-[#393937] px-4 py-2.5 break-words whitespace-pre-wrap font-serif text-[16px] leading-[1.5] text-[#141413] dark:text-[#faf9f5]">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="mb-6 group/msg">
              {/* Assistant label — Claude shows "Claude" above first assistant message */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-sans text-xs font-medium text-[#87867f] dark:text-[#a3a098]">Quaesitor</span>
              </div>
              <div className="prose prose-claude font-serif break-words text-[#141413] dark:text-[#faf9f5] max-w-none">
                <ReactMarkdown components={claudeMarkdownComponents}>{msg.content}</ReactMarkdown>
              </div>
              {/* Action bar — appears on hover (Claude pattern) */}
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                <button
                  onClick={() => copyMessage(i, msg.content)}
                  className="flex size-7 items-center justify-center rounded-md text-[#87867f] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors"
                  aria-label="Copy"
                >
                  {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-[#c96442]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )
        ))}

        {streaming && streamingResponse && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-sans text-xs font-medium text-[#87867f] dark:text-[#a3a098]">Quaesitor</span>
            </div>
            <div className="prose prose-claude font-serif break-words text-[#141413] dark:text-[#faf9f5] max-w-none">
              <ReactMarkdown components={claudeMarkdownComponents}>{streamingResponse}</ReactMarkdown>
              <span className="inline-block h-4 w-1.5 bg-[#c96442] animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {streaming && !streamingResponse && (
          <div className="mb-6 space-y-2 animate-pulse">
            <div className="h-4 bg-[#e8e6dc] dark:bg-[#393937] rounded w-3/4" />
            <div className="h-4 bg-[#e8e6dc] dark:bg-[#393937] rounded w-full" />
            <div className="h-4 bg-[#e8e6dc] dark:bg-[#393937] rounded w-5/6" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 py-2 text-sm text-[#c44848] border-t border-[#c44848]/20">
          {error}
        </div>
      )}

      <div className="mt-4">
        <form className="flex items-center gap-2 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] dark:border-[#3d3a35] dark:bg-[#1a1a18] px-3.5 pt-3 pb-2.5 focus-within:border-[#d97757]/50 transition-colors">
          <textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a follow-up..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 font-serif text-[16px] leading-[1.5] text-[#141413] dark:text-[#faf9f5] focus:outline-none placeholder:text-[#87867f] py-1 min-h-[24px] max-h-[100px]"
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
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:bg-[#3d3d3a] dark:hover:bg-[#e8e6dc] transition-colors"
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); sendFollowUp(); }}
              disabled={!followUp.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#c96442] dark:bg-[#d97757] text-[#faf9f5] hover:bg-[#b5563a] dark:hover:bg-[#c6613f] disabled:opacity-30 transition-colors"
              aria-label="Send"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </form>
        {tokens > 0 && (
          <p className="text-[10px] text-[#87867f] mt-1.5 font-mono text-center">~{tokens} tokens total</p>
        )}
      </div>
    </motion.div>
  );

});
