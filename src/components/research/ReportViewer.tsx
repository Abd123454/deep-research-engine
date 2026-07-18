"use client";

import * as React from "react";
import { FileText, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/types";
import { LOG_COLORS, LOG_PREFIX } from "@/lib/research-ui-utils";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";
import { CompassLogo } from "@/components/CompassLogo";
// P0-8: inline citation hover cards. parseCitations splits a text node
// into strings + <CitationHoverCard> elements based on [N] patterns.
// When sources are provided (research reports have them), citations
// become interactive hover cards showing the source title, URL, tier
// badge, and verification status.
import {
  parseCitations,
  type CitationSource,
} from "@/components/CitationHoverCard";
import type { Source } from "@/lib/types";
import type { VerificationReport } from "@/lib/citation-verifier";

// ---------- ReportViewer ----------

interface ReportViewerProps {
  report: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  // If true, the report is being streamed token-by-token. Show a typing cursor.
  streaming?: boolean;
  /**
   * P0-8: optional source list for inline citation hover cards. When
   * provided, [N] patterns in the report become interactive hover cards
   * (popover with title, URL, tier badge, verified badge). When absent,
   * citations render as plain [N] text.
   */
  sources?: Source[] | null;
  /**
   * P0-8: optional verification report from the citation-verifier. When
   * provided, each citation hover card shows a verified/unverified/
   * contradicted badge based on the verifier's outcome for that URL.
   */
  verificationReport?: VerificationReport | null;
}

export function ReportViewer({ report, copied, onCopy, onDownload: _onDownload, streaming, sources, verificationReport }: ReportViewerProps) {
  const t = useT();

  // P0-8: build a citation-number → verification-status map from the
  // verifier's report. The verifier reports per-URL status; we map each
  // source's URL to its status, then index by citation number (1-based)
  // to match the [N] patterns in the report.
  const verificationMap = React.useMemo(() => {
    if (!verificationReport || !sources || sources.length === 0) return null;
    const m = new Map<number, "verified" | "unverified" | "contradicts">();
    // For each source (indexed 1..N), find the matching verifier detail
    // entry by URL and record its status.
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i]!;
      const detail = verificationReport.details.find(
        (d) => d.url === src.url || d.url.replace(/\/$/, "") === src.url.replace(/\/$/, "")
      );
      if (detail) {
        m.set(i + 1, detail.supportsClaim);
      }
    }
    return m;
  }, [verificationReport, sources]);

  // P0-8: convert the engine's Source[] to the looser CitationSource[]
  // shape that CitationHoverCard accepts. We do this once per render
  // (cheap — just a map over the array).
  const citationSources: CitationSource[] | null = React.useMemo(() => {
    if (!sources || sources.length === 0) return null;
    return sources.map((s) => ({
      url: s.url,
      title: s.title,
      host: s.host,
      excerpt: s.excerpt,
      publishedTime: s.publishedTime,
    }));
  }, [sources]);

  // P0-8: walk markdown children, replacing [N] patterns with hover
  // cards. Mirrors the ChatCard implementation. When `citationSources`
  // is null (no sources), children pass through unchanged — preserving
  // the pre-existing rendering.
  const renderWithCitations = React.useCallback(
    (children: React.ReactNode): React.ReactNode => {
      if (!citationSources) return children;
      if (typeof children === "string") {
        return parseCitations(children, citationSources, verificationMap);
      }
      if (Array.isArray(children)) {
        return children.map((child, i) => {
          if (typeof child === "string") {
            return (
              <React.Fragment key={i}>
                {parseCitations(child, citationSources, verificationMap)}
              </React.Fragment>
            );
          }
          return child;
        });
      }
      return children;
    },
    [citationSources, verificationMap]
  );

  // Quaesitor markdown components — same as ChatCard but with citation
  // support. We define them inline (not as a shared constant) because
  // they close over `renderWithCitations` which depends on the source
  // list (which differs per report).
  const markdownComponents: Record<string, React.ComponentType<any>> = {
    p: ({ children }: any) => <p>{renderWithCitations(children)}</p>,
    li: ({ children }: any) => <li>{renderWithCitations(children)}</li>,
    h1: ({ children }: any) => <h1>{renderWithCitations(children)}</h1>,
    h2: ({ children }: any) => <h2>{renderWithCitations(children)}</h2>,
    h3: ({ children }: any) => <h3>{renderWithCitations(children)}</h3>,
    h4: ({ children }: any) => <h4>{renderWithCitations(children)}</h4>,
  };

  return (
    <Card className="border-border/70">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {streaming ? t("writingReport") : t("finalReport")}
            </h3>
            {streaming && (
              <span className="inline-block h-3 w-1.5 bg-[#8b4513] dark:bg-[#b5673a] animate-pulse ml-0.5" />
            )}
          </div>
          <div className="flex gap-1 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopy}
              className="h-7 gap-1 text-xs"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </Button>
            {!streaming && report && (
              <ExportMenu
                content={report}
                filename="research-report"
                className=""
              />
            )}
          </div>
        </div>
        <article className="px-5 py-4 prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-primary prose-blockquote:not-italic">
          {/* plain text while streaming parses
              the entire string on every token = browser freeze on long reports).
              Switch to ReactMarkdown only when streaming is done. */}
          {streaming ? (
            <pre className="whitespace-pre-wrap text-sm font-ui not-prose">{report}<span className="inline-block h-4 w-2 bg-[#8b4513] dark:bg-[#b5673a] animate-pulse align-text-bottom" /></pre>
          ) : (
            <ReactMarkdown components={markdownComponents}>{report}</ReactMarkdown>
          )}
        </article>
      </CardContent>
    </Card>
  );
}

// ---------- LiveActivity (shown when report not ready yet) ----------

export function LiveActivity({ logs }: { logs: LogEntry[] }) {
  const t = useT();
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
        <CompassLogo className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("liveActivity")}</h3>
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
