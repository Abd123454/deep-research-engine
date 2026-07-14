"use client";

// QuickCard — a single Q&A pair (question + streaming answer).
// Used in the unified interface when the user asks a quick question.

import * as React from "react";
import { motion } from "framer-motion";
import { Zap, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";

interface QuickCardProps {
  question: string;
}

export function QuickCard({ question }: QuickCardProps) {
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
            setError(data.error || `HTTP ${res.status}`);
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
              } catch {
                /* skip */
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (!cancelled) setStreaming(false);
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
      className="rounded-2xl border border-border/60 shadow-sm overflow-hidden"
    >
      {/* Question */}
      <div className="bg-secondary/50 px-5 py-3 flex items-start gap-2">
        <Zap className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p className="text-sm font-medium text-foreground">{question}</p>
      </div>

      {/* Answer */}
      <div className="px-5 py-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("quickThinking")}
          </div>
        )}
      </div>
    </motion.div>
  );
}
