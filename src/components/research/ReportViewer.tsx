"use client";

import * as React from "react";
import { FileText, Copy, Check, Download, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/types";
import { LOG_COLORS, LOG_PREFIX } from "@/lib/research-ui-utils";

// ---------- ReportViewer ----------

interface ReportViewerProps {
  report: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  // If true, the report is being streamed token-by-token. Show a typing cursor.
  streaming?: boolean;
}

export function ReportViewer({ report, copied, onCopy, onDownload, streaming }: ReportViewerProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {streaming ? "Writing report..." : "Final report"}
            </h3>
            {streaming && (
              <span className="inline-block h-3 w-1.5 bg-primary animate-pulse ml-0.5" />
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopy}
              className="h-7 gap-1 text-xs"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-7 gap-1 text-xs"
            >
              <Download className="h-3 w-3" />
              .md
            </Button>
          </div>
        </div>
        <article className="px-5 py-4 prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-primary prose-blockquote:not-italic">
          {/* BUG 2 FIX: plain text while streaming (ReactMarkdown re-parses
              the entire string on every token = browser freeze on long reports).
              Switch to ReactMarkdown only when streaming is done. */}
          {streaming ? (
            <pre className="whitespace-pre-wrap text-sm font-sans not-prose">{report}<span className="inline-block h-4 w-2 bg-primary animate-pulse align-text-bottom" /></pre>
          ) : (
            <ReactMarkdown>{report}</ReactMarkdown>
          )}
        </article>
      </CardContent>
    </Card>
  );
}

// ---------- LiveActivity (shown when report not ready yet) ----------

export function LiveActivity({ logs }: { logs: LogEntry[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const recent = logs.slice(-30);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Live activity</h3>
      </div>
      <div
        ref={containerRef}
        className="max-h-[460px] overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3 font-mono text-[11px] space-y-1"
      >
        {recent.length === 0 && (
          <p className="text-muted-foreground italic">Waiting for activity...</p>
        )}
        {recent.map((l, i) => (
          <LogLine key={i} entry={l} />
        ))}
      </div>
    </div>
  );
}

// ---------- LogLine ----------

export function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.ts).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/50 shrink-0">{time}</span>
      <span className={`shrink-0 ${LOG_COLORS[entry.level]}`}>
        {LOG_PREFIX[entry.level]}
      </span>
      <span className={`break-words ${LOG_COLORS[entry.level]}`}>
        {entry.message}
      </span>
    </div>
  );
}
