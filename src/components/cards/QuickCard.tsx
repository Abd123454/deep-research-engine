"use client";
import * as Sentry from "@sentry/nextjs";

// QuickCard — a single Q&A pair (question + streaming answer).
// Used in the unified interface when the user asks a quick question.

import * as React from "react";
import { motion } from "framer-motion";
import { Zap, Sparkles, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";

interface QuickCardProps {
  question: string;
}

export const QuickCard = React.memo(function QuickCard({ question }: QuickCardProps) {
  const t = useT();
  const [response, setResponse] = React.useState("");
  const [streaming, setStreaming] = React.useState(true);
  const [tokens, setTokens] = React.useState(0);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/modes/quick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            const errorMsg = res.status === 503
              ? "⚠️ No LLM provider configured. Set NVIDIA_API_KEY (free at build.nvidia.com) or another provider key in .env"
              : res.status === 402
              ? "⚠️ Plan limit reached. Upgrade at /pricing"
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
                  token?: string;
                  done?: boolean;
                  tokensUsed?: number;
                  error?: string;
                };
                if (cancelled) return;
                if (data.token) setResponse((r) => r + data.token);
                if (data.done && data.tokensUsed) setTokens(data.tokensUsed);
                if (data.error) setError(data.error);
              } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* skip */
              
}
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (!cancelled) setStreaming(false);
        // Auto-extract memories from this Q&A (non-blocking).
        if (!cancelled && response) {
          fetch("/api/memories/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation: [
                { role: "user", content: question },
                { role: "assistant", content: response },
              ],
            }),
          }).catch(() => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border/60 shadow-md overflow-hidden"
    >
      {/* Question */}
      <div className="bg-gradient-to-r from-secondary to-background px-5 py-3 flex items-start gap-2 border-b border-border/40">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{question}</p>
      </div>

      {/* Answer */}
      <div className="px-5 py-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => { setError(""); setStreaming(true); setResponse(""); }}
                className="text-xs text-primary hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        ) : response ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                {streaming ? t("quickThinking") : t("answer")}
              </span>
              {streaming && (
                <span className="inline-block h-3 w-1.5 bg-primary animate-pulse ml-0.5" />
              )}
              {!streaming && (
                <div className="ml-auto">
                  <ExportMenu content={response} filename="quick-answer" />
                </div>
              )}
            </div>
            <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown>{response}</ReactMarkdown>
            </article>
            {!streaming && tokens > 0 && (
              <p className="text-[10px] text-muted-foreground/50 mt-3 font-mono">~{tokens} tokens</p>
            )}
          </>
        ) : (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

);
