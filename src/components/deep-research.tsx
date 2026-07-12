"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Quote,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Square,
  Pencil,
  X,
  ChevronDown,
  Globe,
  GitBranch,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ResearchJob } from "@/lib/types";
import type { ResearchPlan } from "@/lib/types";
import {
  stageMeta,
  stageProgress,
  fmtTime,
  dedupeSources,
} from "@/lib/research-ui-utils";
import { ResearchInput } from "@/components/research/ResearchInput";
import { ResearchStatus } from "@/components/research/ResearchStatus";
import { ResearchPlan as ResearchPlanCard } from "@/components/research/ResearchPlan";
import { GapAnalysis } from "@/components/research/GapAnalysis";
import { SubQueryList } from "@/components/research/SubQueryList";
import { SourcesList } from "@/components/research/SourcesList";
import { ReportViewer, LiveActivity } from "@/components/research/ReportViewer";
import { ActivityLogModal } from "@/components/research/ActivityLog";
import { PlanPreviewLoading } from "@/components/research/PlanPreview";

const MAX_QUERY_CHARS = 100_000;

// CHANGE 1: Auto-start flow.
//   idle → planning → researching → done
// No more "plan_preview" phase. After plan generation, research starts
// immediately. User can Stop or Edit-restart during research.
type UIPhase = "idle" | "planning" | "researching";

export function DeepResearch() {
  // ---------- Input state ----------
  const [query, setQuery] = React.useState("");
  const [depth, setDepth] = React.useState<"standard" | "deep" | "advanced">("advanced");
  const [numSubQueries, setNumSubQueries] = React.useState(8);
  const [maxLinks, setMaxLinks] = React.useState(25);
  const [reportTokens, setReportTokens] = React.useState(8000);
  const [showSettings, setShowSettings] = React.useState(false);

  // ---------- Phase + plan state ----------
  const [phase, setPhase] = React.useState<UIPhase>("idle");
  const [planExpanded, setPlanExpanded] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editPlan, setEditPlan] = React.useState<ResearchPlan | null>(null);

  // ---------- Job state ----------
  const [job, setJob] = React.useState<ResearchJob | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);
  // CHANGE 2: expandable sections (collapsed by default).
  const [sourcesExpanded, setSourcesExpanded] = React.useState(false);
  const [subQueriesExpanded, setSubQueriesExpanded] = React.useState(false);
  const [techDetailsOpen, setTechDetailsOpen] = React.useState(false);

  const stopPollingRef = React.useRef(false);
  const currentJobIdRef = React.useRef<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 560)}px`;
  }, [query]);

  const isRunning = job && job.status !== "completed" && job.status !== "failed";
  const isCancelled = job?.status === "failed" && job?.error === "Cancelled by user";

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

  // ---------- Auto-start: generate plan → immediately start research ----------
  async function startResearch() {
    if (!query.trim()) {
      toast.error("Please enter a research query.");
      return;
    }
    setStarting(true);
    setPhase("planning");
    setJob(null);
    stopPollingRef.current = false;
    try {
      // Step 1: generate the plan.
      const planRes = await fetch("/api/research/plan", {
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
      const planData = (await planRes.json()) as {
        ok: boolean;
        plan?: ResearchPlan;
        error?: string;
      };
      if (!planRes.ok || !planData.ok || !planData.plan) {
        throw new Error(planData.error || "Failed to generate plan.");
      }

      // Step 2: immediately start research with the plan (no user confirmation).
      setPhase("researching");
      const startRes = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          depth,
          numSubQueries,
          maxLinksPerQuery: maxLinks,
          reportMaxTokens: reportTokens,
          plan: planData.plan,
        }),
      });
      const startData = (await startRes.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (!startRes.ok || !startData.ok || !startData.id) {
        throw new Error(startData.error || "Failed to start research.");
      }
      currentJobIdRef.current = startData.id;
      toast.success("Deep research started");
      // Set an initial job object with the plan so the UI shows the plan
      // card immediately — before the first SSE update arrives.
      setJob({
        id: startData.id,
        query: query.trim(),
        status: "planning",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        config: {
          query: query.trim(),
          depth,
          numSubQueries,
          maxLinksPerQuery: maxLinks,
          pageReadConcurrency: 4,
          reportMaxTokens: reportTokens,
          retriever: "tavily",
          llmProvider: "nvidia",
          enableMultiRound: depth !== "standard",
          numGapQueries: depth === "advanced" ? 3 : depth === "deep" ? 2 : 0,
        },
        plan: planData.plan,
        gapAnalysis: null,
        round2FollowUps: [],
        subQueries: [],
        sources: [],
        report: null,
        logs: [],
        error: null,
        cancelled: false,
        stats: {
          totalPagesFound: 0,
          totalPagesRead: 0,
          totalPagesSucceeded: 0,
          totalTokensUsed: 0,
          elapsedMs: 0,
          subQueriesCompleted: 0,
          roundsCompleted: 0,
        },
      });
      setPolling(true);
      streamJob(startData.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to start research", { description: msg });
      setPhase("idle");
    } finally {
      setStarting(false);
    }
  }

  // ---------- Stop research ----------
  async function stopResearch() {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;
    stopPollingRef.current = true;
    setPolling(false);
    try {
      await fetch(`/api/research/stop/${jobId}`, { method: "POST" });
      toast.info("Research cancelled");
    } catch {
      /* ignore — client-side stop is enough */
    }
    setPhase("idle");
    setJob(null);
    currentJobIdRef.current = null;
  }

  // ---------- Edit plan: open modal ----------
  function openEditPlan() {
    if (!job?.plan) return;
    setEditPlan({ ...job.plan });
    setEditModalOpen(true);
  }

  // ---------- Edit plan: save & restart ----------
  async function saveEditedPlan(restartedPlan: ResearchPlan) {
    setEditModalOpen(false);
    setEditPlan(null);

    // Stop current research.
    const oldJobId = currentJobIdRef.current;
    if (oldJobId) {
      stopPollingRef.current = true;
      setPolling(false);
      try {
        await fetch(`/api/research/stop/${oldJobId}`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }

    // Start new research with edited plan.
    setStarting(true);
    setJob(null);
    stopPollingRef.current = false;
    setPhase("researching");
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
          plan: restartedPlan,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        throw new Error(data.error || "Failed to restart research.");
      }
      currentJobIdRef.current = data.id;
      toast.success("Research restarted with edited plan");
      setPolling(true);
      streamJob(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to restart", { description: msg });
      setPhase("idle");
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
          } else if (data.error === "Cancelled by user") {
            toast.info("Research cancelled");
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
              } else if (data.job.error === "Cancelled by user") {
                toast.info("Research cancelled");
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
    setPhase("idle");
    currentJobIdRef.current = null;
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
          {phase === "idle" && (
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
          )}

          {phase === "planning" && <PlanPreviewLoading key="planning" />}

          {phase === "researching" && job && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-5"
            >
              {/* Status header + action buttons */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <ResearchStatus job={job} isRunning={!!isRunning} onReset={reset} />
                </div>
                {isRunning && (
                  <div className="flex gap-1.5 shrink-0">
                    {job.plan && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openEditPlan}
                        className="gap-1.5 text-xs rounded-full"
                      >
                        <Pencil className="h-3 w-3" /> Edit plan
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={stopResearch}
                      className="gap-1.5 text-xs rounded-full text-destructive hover:text-destructive"
                    >
                      <Square className="h-3 w-3" /> Stop
                    </Button>
                  </div>
                )}
              </div>

              {/* Collapsed plan card */}
              {job.plan && job.plan.sections.length > 0 && (
                <Collapsible open={planExpanded} onOpenChange={setPlanExpanded}>
                  <Card className="border-border/70 shadow-sm">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between gap-2 px-5 py-3 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Plan
                          </span>
                          <span className="text-sm font-medium truncate">
                            {job.plan.title}
                          </span>
                          <Badge variant="secondary" className="text-[10px] rounded-full shrink-0">
                            {job.plan.sections.length} sections
                          </Badge>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", planExpanded && "rotate-180")} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-5 pb-4">
                        <ResearchPlanCard plan={job.plan} />
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Gap analysis */}
              {job.gapAnalysis && <GapAnalysis gapAnalysis={job.gapAnalysis} />}

              {/* Report — HERO, full width (CHANGE 2: was in a 2-col grid) */}
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

              {/* Expandable sections (CHANGE 2: collapsed by default) */}
              <div className="flex flex-wrap gap-2 pt-1">
                {dedupedSources.length > 0 && (
                  <Collapsible open={sourcesExpanded} onOpenChange={setSourcesExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full">
                        <Globe className="h-3 w-3" />
                        Sources ({dedupedSources.length})
                        <ChevronDown className={cn("h-3 w-3 transition-transform", sourcesExpanded && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <SourcesList sources={dedupedSources} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {job.subQueries.length > 0 && (
                  <Collapsible open={subQueriesExpanded} onOpenChange={setSubQueriesExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full">
                        <GitBranch className="h-3 w-3" />
                        Sub-queries ({job.subQueries.length})
                        <ChevronDown className={cn("h-3 w-3 transition-transform", subQueriesExpanded && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3">
                        <SubQueryList subQueries={job.subQueries} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {job.logs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTechDetailsOpen(true)}
                    className="gap-1.5 text-xs rounded-full"
                  >
                    <Hash className="h-3 w-3" />
                    Technical details ({job.logs.length})
                  </Button>
                )}
              </div>

              {/* Activity log modal (CHANGE 2: was inline collapsible) */}
              <ActivityLogModal
                logs={job.logs}
                open={techDetailsOpen}
                onOpenChange={setTechDetailsOpen}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Edit plan modal */}
      {editModalOpen && editPlan && (
        <EditPlanModal
          plan={editPlan}
          setPlan={setEditPlan}
          onSave={saveEditedPlan}
          onCancel={() => {
            setEditModalOpen(false);
            setEditPlan(null);
          }}
        />
      )}

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

// ---------- Edit plan modal (inline, no dialog dependency) ----------

function EditPlanModal({
  plan,
  setPlan,
  onSave,
  onCancel,
}: {
  plan: ResearchPlan;
  setPlan: (p: ResearchPlan) => void;
  onSave: (p: ResearchPlan) => void;
  onCancel: () => void;
}) {
  const updateTitle = (title: string) => setPlan({ ...plan, title });
  const updateSummary = (summary: string) => setPlan({ ...plan, summary });
  const updateSection = (id: string, field: "title" | "description", value: string) =>
    setPlan({
      ...plan,
      sections: plan.sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    });
  const removeSection = (id: string) =>
    setPlan({ ...plan, sections: plan.sections.filter((s) => s.id !== id) });
  const addSection = () => {
    if (plan.sections.length >= 9) return;
    setPlan({
      ...plan,
      sections: [
        ...plan.sections,
        { id: `s${Date.now()}`, title: "New section", description: "Describe what this section covers." },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Edit research plan</h3>
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Report title</Label>
            <Input
              value={plan.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Summary</Label>
            <textarea
              value={plan.summary}
              onChange={(e) => updateSummary(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[60px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">
              Sections ({plan.sections.length}/9)
            </Label>
            {plan.sections.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white mt-1">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, "title", e.target.value)}
                    className="h-8 text-xs font-medium"
                  />
                  <textarea
                    value={s.description}
                    onChange={(e) => updateSection(s.id, "description", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] min-h-[36px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    onClick={() => removeSection(s.id)}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {plan.sections.length < 9 && (
              <button
                onClick={addSection}
                className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/40"
              >
                + Add section
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(plan)}
              className="text-xs bg-brand-gradient hover:opacity-90 border-0 gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Save & restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Need these imports for the modal.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
