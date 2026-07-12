"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Quote, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ResearchJob } from "@/lib/types";
import {
  stageMeta,
  stageProgress,
  fmtTime,
  dedupeSources,
} from "@/lib/research-ui-utils";
import { ResearchInput } from "@/components/research/ResearchInput";
import { ResearchStatus } from "@/components/research/ResearchStatus";
import { ResearchPlan } from "@/components/research/ResearchPlan";
import { GapAnalysis } from "@/components/research/GapAnalysis";
import { SubQueryList } from "@/components/research/SubQueryList";
import { SourcesList } from "@/components/research/SourcesList";
import { ReportViewer, LiveActivity } from "@/components/research/ReportViewer";
import { ActivityLog } from "@/components/research/ActivityLog";

const MAX_QUERY_CHARS = 100_000;

export function DeepResearch() {
  // ---------- Input state ----------
  const [query, setQuery] = React.useState("");
  const [depth, setDepth] = React.useState<"standard" | "deep" | "advanced">("advanced");
  const [numSubQueries, setNumSubQueries] = React.useState(8);
  const [maxLinks, setMaxLinks] = React.useState(25);
  const [reportTokens, setReportTokens] = React.useState(8000);
  const [showSettings, setShowSettings] = React.useState(false);

  // ---------- Job state ----------
  const [job, setJob] = React.useState<ResearchJob | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);

  const stopPollingRef = React.useRef(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 560)}px`;
  }, [query]);

  const isRunning = job && job.status !== "completed" && job.status !== "failed";

  const dedupedSources = React.useMemo(
    () => (job ? dedupeSources(job.sources) : []),
    [job?.sources]
  );

  // ---------- Depth preset helper ----------
  function applyDepth(d: "standard" | "deep" | "advanced") {
    setDepth(d);
    if (d === "standard") {
      setNumSubQueries(4);
      setMaxLinks(5);
    } else if (d === "deep") {
      setNumSubQueries(6);
      setMaxLinks(10);
    } else {
      setNumSubQueries(8);
      setMaxLinks(25);
    }
  }

  // ---------- Start research ----------
  async function startResearch() {
    if (!query.trim()) {
      toast.error("Please enter a research query.");
      return;
    }
    setStarting(true);
    setJob(null);
    stopPollingRef.current = false;
    try {
      const res = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          depth,
          numSubQueries,
          maxLinksPerQuery: maxLinks,
          reportMaxTokens: reportTokens,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        throw new Error(data.error || "Failed to start research.");
      }
      toast.success("Deep research started");
      setPolling(true);
      streamJob(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to start research", { description: msg });
    } finally {
      setStarting(false);
    }
  }

  // ---------- SSE streaming (with polling fallback) ----------
  function streamJob(id: string) {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      pollJob(id);
      return;
    }
    let es: EventSource | null = null;
    let fallbackStarted = false;

    const startFallback = (reason: string) => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      console.warn(`[stream] SSE failed (${reason}), falling back to polling.`);
      if (es) es.close();
      pollJob(id);
    };

    const watchdog = setTimeout(() => {
      if (!stopPollingRef.current) startFallback("no events in 30s");
    }, 30_000);

    try {
      es = new EventSource(`/api/research/stream/${id}`);

      es.addEventListener("update", (e: MessageEvent) => {
        clearTimeout(watchdog);
        try {
          const data = JSON.parse(e.data) as { ok: boolean; job?: ResearchJob };
          if (data.ok && data.job) setJob(data.job);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("done", (e: MessageEvent) => {
        clearTimeout(watchdog);
        es?.close();
        setPolling(false);
        try {
          const data = JSON.parse(e.data) as { status: string; error?: string };
          if (data.status === "completed") {
            toast.success("Deep research completed!");
          } else {
            toast.error("Research failed", { description: data.error || "Unknown" });
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("error", () => {
        clearTimeout(watchdog);
        if (stopPollingRef.current) return;
        startFallback("connection error");
      });

      es.addEventListener("open", () => clearTimeout(watchdog));
    } catch {
      clearTimeout(watchdog);
      startFallback("EventSource construction failed");
    }
  }

  // ---------- Polling fallback ----------
  async function pollJob(id: string) {
    let interval = 1500;
    let consecutive404 = 0;
    const pollStart = Date.now();
    while (!stopPollingRef.current) {
      if (Date.now() - pollStart > 30 * 60 * 1000) {
        setPolling(false);
        toast.error("Research timed out", { description: "30 min limit." });
        return;
      }
      try {
        const res = await fetch(`/api/research/status/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          consecutive404++;
          if (consecutive404 >= 3) {
            setPolling(false);
            toast.error("Research job was evicted from memory");
            return;
          }
        } else if (!res.ok) {
          throw new Error(`Status fetch failed (${res.status})`);
        } else {
          consecutive404 = 0;
          const data = (await res.json()) as { ok: boolean; job?: ResearchJob };
          if (data.ok && data.job) {
            setJob(data.job);
            if (data.job.status === "completed" || data.job.status === "failed") {
              setPolling(false);
              if (data.job.status === "completed") {
                toast.success("Deep research completed!");
              } else {
                toast.error("Research failed", { description: data.job.error || "Unknown" });
              }
              return;
            }
          }
        }
      } catch (err) {
        console.error("poll error", err);
      }
      await new Promise((r) => setTimeout(r, interval));
      interval = 1500;
    }
    setPolling(false);
  }

  // ---------- Actions ----------
  function reset() {
    stopPollingRef.current = true;
    setPolling(false);
    setJob(null);
  }

  async function copyReport() {
    if (!job?.report) return;
    try {
      await navigator.clipboard.writeText(job.report);
      setCopied(true);
      toast.success("Report copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  function downloadReport() {
    if (!job?.report) return;
    const blob = new Blob([job.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deep-research-${job.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- Render ----------
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 aurora-bg" aria-hidden />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
                Deep Research
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Multi-round · Plan-driven · Source-cited
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex gap-1 rounded-full px-2.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
              NVIDIA 6 LLMs · Tavily+2
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {!job ? (
            <ResearchInput
              key="input"
              query={query}
              setQuery={setQuery}
              depth={depth}
              applyDepth={applyDepth}
              numSubQueries={numSubQueries}
              setNumSubQueries={setNumSubQueries}
              maxLinks={maxLinks}
              setMaxLinks={setMaxLinks}
              reportTokens={reportTokens}
              setReportTokens={setReportTokens}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              starting={starting}
              startResearch={startResearch}
              textareaRef={textareaRef}
            />
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-5"
            >
              {/* Status header */}
              <ResearchStatus job={job} isRunning={!!isRunning} onReset={reset} />

              {/* Research plan */}
              {job.plan && job.plan.sections.length > 0 && (
                <ResearchPlan plan={job.plan} />
              )}

              {/* Gap analysis */}
              {job.gapAnalysis && <GapAnalysis gapAnalysis={job.gapAnalysis} />}

              {/* Two-column: report/activity + sub-queries/sources */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-4">
                  {job.report ? (
                    <ReportViewer
                      report={job.report}
                      copied={copied}
                      onCopy={copyReport}
                      onDownload={downloadReport}
                    />
                  ) : (
                    <div className="rounded-xl border bg-card p-5">
                      <LiveActivity logs={job.logs} />
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <SubQueryList subQueries={job.subQueries} />
                  <SourcesList sources={dedupedSources} />
                </div>
              </div>

              {/* Activity log */}
              <ActivityLog
                logs={job.logs}
                open={logsOpen}
                onOpenChange={setLogsOpen}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/60 bg-background/50 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Multi-round deep research · plan → search → gap analysis → round 2 → report
          </p>
          <p className="flex items-center gap-1.5">
            <Quote className="h-3 w-3" />
            Z.AI SDK · NVIDIA NIM ready
          </p>
        </div>
      </footer>
    </div>
  );
}
