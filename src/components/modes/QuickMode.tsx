"use client";
import * as Sentry from "@sentry/nextjs";

// QuickMode — single LLM call with streaming response.
// No research pipeline, no web search. Just ask → NVIDIA answers.

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useT } from "@/components/i18n/locale-provider";

export function QuickMode() {
  const t = useT();
  const [input, setInput] = React.useState("");
  const [response, setResponse] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [tokens, setTokens] = React.useState(0);
  const [error, setError] = React.useState("");

  async function send() {
    if (!input.trim() || streaming) return;
    setStreaming(true);
    setResponse("");
    setTokens(0);
    setError("");

    try {
      const res = await fetch("/api/modes/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
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
                token?: string;
                done?: boolean;
                tokensUsed?: number;
                error?: string;
              };
              if (data.token) setResponse((r) => r + data.token);
              if (data.done && data.tokensUsed) setTokens(data.tokensUsed);
              if (data.error) setError(data.error);
            } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* skip unparseable */
            
}
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t("quickTitle")}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">{t("quickSubtitle")}</p>
      </div>

      {/* Input */}
      <div className="rounded-2xl bg-secondary shadow-sm focus-within:shadow-md transition-shadow">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("quickPlaceholder")}
          className="min-h-[80px] resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:block">
            ⌘+Enter
          </span>
          <Button
            onClick={send}
            disabled={!input.trim() || streaming}
            size="icon"
            className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 border-0"
            aria-label={t("quickSend")}
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Response */}
      {(response || streaming) && (
        <div className="rounded-2xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {streaming ? t("quickThinking") : t("quickResponse")}
            </span>
            {streaming && (
              <span className="inline-block h-3 w-1.5 bg-primary animate-pulse ml-0.5" />
            )}
          </div>
          {response ? (
            <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown>{response}</ReactMarkdown>
            </article>
          ) : (
            !error && (
              <p className="text-muted-foreground text-sm italic">
                {t("quickThinking")}
              </p>
            )
          )}
          {!streaming && tokens > 0 && (
            <p className="text-[11px] text-muted-foreground/50 mt-4 font-mono">
              ~{tokens} tokens
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
