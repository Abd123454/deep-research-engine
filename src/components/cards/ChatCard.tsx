"use client";

// ChatCard — multi-turn conversational chat in the unified interface.
// Unlike QuickCard (single Q&A), ChatCard supports follow-up questions
// within the same conversation context.

import * as React from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/ExportMenu";

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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

  // Send initial message on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setStreaming(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: initialMessage, conversationId: initialConvId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) { setError(data.error || `HTTP ${res.status}`); setStreaming(false); }
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
                if (data.token) setStreamingResponse((r) => r + data.token);
                if (data.done) {
                  if (data.conversationId) setConversationId(data.conversationId);
                  if (data.tokensUsed) setTokens(data.tokensUsed);
                }
                if (data.error) setError(data.error);
              } catch { /* skip */ }
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chat failed");
      } finally {
        if (!cancelled) {
          setStreaming(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: streamingResponse || "(empty response)" },
          ]);
          setStreamingResponse("");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendFollowUp() {
    if (!followUp.trim() || streaming) return;
    const userMsg = followUp.trim();
    setFollowUp("");
    setError("");

    // Add user message + empty assistant placeholder.
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    setStreamingResponse("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversationId }),
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
      let fullResponse = "";
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
            } catch { /* skip */ }
          }
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: fullResponse || "(empty)" }]);
      setStreamingResponse("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow-up failed");
    } finally {
      setStreaming(false);
    }
  }

  const fullConversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border/60 shadow-md overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-secondary to-background px-5 py-3 flex items-center gap-2 border-b border-border/40">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium">Conversation</span>
        {!streaming && messages.length > 1 && (
          <div className="ml-auto">
            <ExportMenu content={fullConversation} filename="conversation" />
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[500px] overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <article className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </article>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streaming && streamingResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm">
              <article className="prose prose-sm max-w-none prose-headings:font-semibold">
                <ReactMarkdown>{streamingResponse}</ReactMarkdown>
              </article>
              <span className="inline-block h-3 w-1.5 bg-primary animate-pulse ml-0.5 mt-1" />
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {streaming && !streamingResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-secondary px-4 py-3 space-y-2 animate-pulse">
              <div className="h-3 bg-muted rounded w-48" />
              <div className="h-3 bg-muted rounded w-32" />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2 text-sm text-destructive border-t border-destructive/20">
          {error}
        </div>
      )}

      {/* Follow-up input */}
      {!streaming && (
        <div className="border-t border-border/40 p-3">
          <div className="flex items-end gap-2 rounded-xl bg-secondary p-1.5">
            <textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Ask a follow-up..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60 py-1.5 px-2 max-h-[100px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendFollowUp();
                }
              }}
            />
            <Button
              onClick={sendFollowUp}
              disabled={!followUp.trim() || streaming}
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-primary hover:bg-primary/90 border-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {tokens > 0 && (
            <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-mono text-center">~{tokens} tokens total</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

);
