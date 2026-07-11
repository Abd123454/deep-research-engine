"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Globe,
  BookOpen,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Hash,
  Layers,
  RefreshCw,
  Brain,
  ListTree,
  GitBranch,
  Target,
  ArrowRight,
  Lightbulb,
  FileSearch,
  Quote,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  ResearchJob,
  ResearchStatus,
  SubQuery,
  LogEntry,
  ResearchPlan,
} from "@/lib/types";

// ---------- stage metadata ----------

const STAGES: {
  key: ResearchStatus;
  label: string;
  icon: React.ElementType;
  hint: string;
}[] = [
  { key: "planning", label: "Planning", icon: ListTree, hint: "Creating a research outline" },
  { key: "decomposing", label: "Decomposing", icon: GitBranch, hint: "Breaking into sub-questions" },
  { key: "searching", label: "Searching", icon: Globe, hint: "Searching the web" },
  { key: "reading", label: "Reading", icon: BookOpen, hint: "Reading pages" },
  { key: "extracting", label: "Extracting", icon: Sparkles, hint: "Extracting findings" },
  { key: "analyzing_gaps", label: "Gap analysis", icon: Target, hint: "Finding knowledge gaps" },
  { key: "synthesizing", label: "Writing", icon: FileText, hint: "Writing the report" },
];

const STAGE_ORDER: ResearchStatus[] = STAGES.map((s) => s.key);

function stageMeta(status: ResearchStatus) {
  return STAGES.find((s) => s.key === status);
}

function stageProgress(status: ResearchStatus): number {
  if (status === "failed") return 100;
  if (status === "queued") return 0;
  if (status === "completed") return 100;
  const idx = STAGE_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.min(99, Math.round(((idx + 0.5) / STAGE_ORDER.length) * 100));
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

// ---------- main component ----------

const MAX_QUERY_CHARS = 100_000;

export function DeepResearch() {
  const [query, setQuery] = React.useState("");
  const [depth, setDepth] = React.useState<"standard" | "deep" | "advanced">("advanced");
  const [numSubQueries, setNumSubQueries] = React.useState(8);
  const [maxLinks, setMaxLinks] = React.useState(25);
  const [reportTokens, setReportTokens] = React.useState(8000);
  const [showSettings, setShowSettings] = React.useState(false);

  const [job, setJob] = React.useState<ResearchJob | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);

  const stopPollingRef = React.useRef(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, 120), 560);
    el.style.height = `${newHeight}px`;
  }, [query]);

  const charCount = query.length;
  const charPct = Math.min(100, (charCount / MAX_QUERY_CHARS) * 100);
  const isOverLimit = charCount > MAX_QUERY_CHARS;
  const isGiant = charCount > 4000;
  const isMega = charCount > 15000;

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
        config?: {
          llmProvider: string;
          retriever: string;
          smartModels?: string[];
          fastModel?: string;
          searchEngines?: string[];
        };
      };
      if (!res.ok || !data.ok || !data.id) {
        throw new Error(data.error || "Failed to start research.");
      }
      const modelCount = data.config?.smartModels?.length || 1;
      const primaryModel = data.config?.smartModels?.[0] || "default";
      const engineCount = data.config?.searchEngines?.length || 1;
      toast.success("Deep research started", {
        description: `${data.config?.llmProvider?.toUpperCase()} · ${modelCount} LLMs · ${engineCount} search engines`,
      });
      setPolling(true);
      pollJob(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to start research", { description: msg });
    } finally {
      setStarting(false);
    }
  }

  async function pollJob(id: string) {
    let interval = 1500;
    let consecutive404 = 0;
    while (!stopPollingRef.current) {
      try {
        const res = await fetch(`/api/research/status/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          consecutive404++;
          if (consecutive404 >= 3) {
            setPolling(false);
            toast.error("Research job was evicted from memory", {
              description: "Try again with a smaller scope.",
            });
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
                toast.success("Deep research completed!", {
                  description: `${data.job.stats.totalPagesRead} pages · ${data.job.stats.roundsCompleted} rounds · ${fmtTime(data.job.stats.elapsedMs)}`,
                });
              } else {
                toast.error("Research failed", {
                  description: data.job.error || "Unknown error",
                });
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

  const isRunning = job && job.status !== "completed" && job.status !== "failed";

  const examples = [
    {
      icon: Lightbulb,
      text: "What are the latest breakthroughs in solid-state battery technology and their commercialization timeline?",
    },
    {
      icon: FileSearch,
      text: "Compare the architectural differences and performance trade-offs between RISC-V and ARM processors.",
    },
    {
      icon: Brain,
      text: "What is the current state of quantum error correction and when might fault-tolerant quantum computers arrive?",
    },
    {
      icon: Layers,
      text: "How do large language model agents work, and what are the main agentic frameworks in 2025?",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ---------- Aurora background ---------- */}
      <div className="pointer-events-none fixed inset-0 aurora-bg" aria-hidden />

      {/* ---------- Header ---------- */}
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

      {/* ---------- Main ---------- */}
      <main className="relative flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {!job ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* ---------- Gemini-style greeting ---------- */}
              <div className="text-center max-w-2xl mx-auto pt-6 sm:pt-10 pb-2">
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-3xl sm:text-5xl font-semibold tracking-tight"
                >
                  <span className="text-brand-gradient">Hello</span> there
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="mt-3 text-muted-foreground text-base sm:text-lg"
                >
                  What should we research deeply today?
                </motion.p>
              </div>

              {/* ---------- Gemini-style input card ---------- */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="mx-auto max-w-3xl"
              >
                <div className="relative rounded-3xl border border-border/80 bg-card/95 backdrop-blur-sm shadow-xl shadow-primary/5 transition-all focus-within:shadow-2xl focus-within:shadow-primary/10 focus-within:border-primary/40">
                  <Textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything — or paste a giant research brief (up to 100K chars). I'll plan, search, read, find gaps, and write a comprehensive report."
                    className="min-h-[120px] resize-none border-0 bg-transparent px-5 pt-5 pb-2 text-[15px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        startResearch();
                      }
                    }}
                  />

                  {/* Bottom bar: counter + settings + send */}
                  <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowSettings((v) => !v)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          showSettings
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {depth}
                        <ChevronDown className={cn("h-3 w-3 transition-transform", showSettings && "rotate-180")} />
                      </button>
                      {isGiant && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "rounded-full text-[10px] gap-1 px-2 py-0.5",
                            isMega
                              ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          )}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {isMega ? "Mega" : "Large"}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-mono tabular-nums hidden sm:block",
                          isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground/70"
                        )}
                      >
                        {fmtNum(charCount)} / {fmtNum(MAX_QUERY_CHARS)}
                      </span>
                      <Button
                        onClick={startResearch}
                        disabled={starting || !query.trim() || isOverLimit}
                        size="icon"
                        className="h-9 w-9 rounded-full bg-brand-gradient hover:opacity-90 shadow-md shadow-primary/20 border-0"
                        aria-label="Start deep research"
                      >
                        {starting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Settings drawer (inline, collapsible) */}
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border/60"
                      >
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">Depth</Label>
                            <Select
                              value={depth}
                              onValueChange={(v) =>
                                applyDepth(v as "standard" | "deep" | "advanced")
                              }
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard</SelectItem>
                                <SelectItem value="deep">Deep</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">
                              Sub-queries: {numSubQueries}
                            </Label>
                            <Input
                              type="number"
                              min={2}
                              max={15}
                              value={numSubQueries}
                              onChange={(e) =>
                                setNumSubQueries(
                                  Math.min(15, Math.max(2, parseInt(e.target.value) || 2))
                                )
                              }
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">
                              Links / query: {maxLinks}
                            </Label>
                            <Input
                              type="number"
                              min={3}
                              max={30}
                              value={maxLinks}
                              onChange={(e) =>
                                setMaxLinks(
                                  Math.min(30, Math.max(3, parseInt(e.target.value) || 3))
                                )
                              }
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">
                              Report tokens
                            </Label>
                            <Input
                              type="number"
                              min={1000}
                              max={32000}
                              step={1000}
                              value={reportTokens}
                              onChange={(e) =>
                                setReportTokens(
                                  Math.min(32000, Math.max(1000, parseInt(e.target.value) || 1000))
                                )
                              }
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="px-4 pb-3 -mt-1 space-y-1">
                          <p className="text-[11px] text-muted-foreground">
                            <strong>Advanced</strong>: {numSubQueries} sub-queries × {maxLinks} links
                            {" "}+ gap analysis → round 2. Up to {numSubQueries * maxLinks + 4 * maxLinks} pages.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            <strong>Multi-round</strong> is enabled on Deep & Advanced —
                            the agent reviews round-1 findings, identifies gaps, and runs a second research round.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {isOverLimit && (
                  <p className="text-xs text-destructive mt-2 text-center">
                    Query exceeds the {fmtNum(MAX_QUERY_CHARS)} character limit.
                  </p>
                )}
              </motion.div>

              {/* ---------- Suggestion chips (Gemini-style) ---------- */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(ex.text)}
                    className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-md hover:shadow-primary/5"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                      <ex.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[13px] leading-snug text-muted-foreground group-hover:text-foreground">
                      {ex.text}
                    </span>
                  </button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-5"
            >
              {/* ---------- Status header ---------- */}
              <Card className="overflow-hidden border-border/70 shadow-lg shadow-primary/5">
                <CardContent className="p-0">
                  {/* Top: query + progress */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {isRunning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : job.status === "completed" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className="text-xs font-medium">
                            {job.status === "completed"
                              ? "Research complete"
                              : job.status === "failed"
                                ? "Research failed"
                                : stageMeta(job.status)?.label || job.status}
                          </span>
                          <Badge variant="outline" className="text-[10px] rounded-full">
                            {job.config.depth}
                          </Badge>
                          {job.stats.roundsCompleted > 0 && (
                            <Badge variant="outline" className="text-[10px] rounded-full gap-1">
                              <GitBranch className="h-2.5 w-2.5" />
                              {job.stats.roundsCompleted} rounds
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          <span className="font-medium text-foreground">Query:</span> {job.query}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={reset}
                        className="gap-1.5 shrink-0 rounded-full"
                      >
                        <RefreshCw className="h-3 w-3" />
                        New
                      </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {isRunning ? stageMeta(job.status)?.hint : "Done"}
                        </span>
                        <span className="font-mono tabular-nums">{stageProgress(job.status)}%</span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full",
                            job.status === "failed"
                              ? "bg-destructive"
                              : "bg-brand-gradient"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${stageProgress(job.status)}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {/* Stage chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {STAGES.map((s) => {
                        const active = job.status === s.key;
                        const passed = STAGE_ORDER.indexOf(job.status) > STAGE_ORDER.indexOf(s.key);
                        const done = job.status === "completed" || passed;
                        return (
                          <div
                            key={s.key}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                              active
                                ? "bg-primary/15 text-primary"
                                : done
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground/60"
                            )}
                          >
                            {active ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : done ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : (
                              <s.icon className="h-2.5 w-2.5" />
                            )}
                            {s.label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <StatPill icon={GitBranch} label="Sub-queries" value={`${job.stats.subQueriesCompleted}/${job.subQueries.length}`} />
                      <StatPill icon={Link2} label="Pages found" value={fmtNum(job.stats.totalPagesFound)} />
                      <StatPill icon={BookOpen} label="Pages read" value={`${job.stats.totalPagesSucceeded}/${job.stats.totalPagesRead}`} />
                      <StatPill icon={Clock} label="Elapsed" value={fmtTime(job.stats.elapsedMs || Date.now() - (job.startedAt || Date.now()))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ---------- Research plan (Gemini-style) ---------- */}
              {job.plan && job.plan.sections.length > 0 && (
                <Card className="border-border/70 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
                        <ListTree className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold leading-tight">Research plan</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          The agent created this outline before researching
                        </p>
                      </div>
                    </div>
                    <h4 className="text-base font-semibold text-brand-gradient mb-1">
                      {job.plan.title}
                    </h4>
                    {job.plan.summary && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                        {job.plan.summary}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {job.plan.sections.map((s, i) => (
                        <div
                          key={s.id}
                          className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-snug">{s.title}</p>
                            {s.description && (
                              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                                {s.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ---------- Gap analysis ---------- */}
              {job.gapAnalysis && (
                <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
                        <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold leading-tight">Gap analysis</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Round-1 review → identified knowledge gaps → triggered round 2
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {job.gapAnalysis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* ---------- Two-column: sub-queries + sources ---------- */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Sub-queries */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Report */}
                  {job.report ? (
                    <Card className="border-border/70 shadow-sm">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Final report</h3>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={copyReport}
                              className="h-7 gap-1 text-xs"
                            >
                              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              Copy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={downloadReport}
                              className="h-7 gap-1 text-xs"
                            >
                              <Download className="h-3 w-3" />
                              .md
                            </Button>
                          </div>
                        </div>
                        <article className="px-5 py-4 prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-primary prose-blockquote:not-italic">
                          <ReactMarkdown>{job.report}</ReactMarkdown>
                        </article>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border/70 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Live activity</h3>
                        </div>
                        <LiveActivity logs={job.logs} />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right: sub-queries + sources */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-border/70 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="h-3.5 w-3.5 text-primary" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide">
                          Sub-queries
                        </h3>
                        <Badge variant="secondary" className="ml-auto text-[10px] rounded-full">
                          {job.subQueries.length}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                        {job.subQueries.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            Generating sub-questions...
                          </p>
                        )}
                        {job.subQueries.map((sq, i) => (
                          <SubQueryCard key={sq.id} index={i} sq={sq} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide">
                          Sources
                        </h3>
                        <Badge variant="secondary" className="ml-auto text-[10px] rounded-full">
                          {dedupeSources(job.sources).length}
                        </Badge>
                      </div>
                      {job.sources.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No sources collected yet.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                          {dedupeSources(job.sources).slice(0, 60).map((s, i) => (
                            <a
                              key={s.url + i}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
                            >
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-mono font-bold text-muted-foreground">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium line-clamp-1 group-hover:text-primary">
                                  {s.title || s.url}
                                </p>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {s.host}
                                </p>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ---------- Activity log (collapsible) ---------- */}
              {job.logs.length > 0 && (
                <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
                  <Card className="border-border/70 shadow-sm">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          Activity log
                          <Badge variant="secondary" className="text-[10px] rounded-full">
                            {job.logs.length}
                          </Badge>
                        </span>
                        {logsOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="max-h-80 overflow-y-auto p-4 font-mono text-[11px] space-y-1">
                        {job.logs.map((l, i) => (
                          <LogLine key={i} entry={l} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ---------- Footer ---------- */}
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

// ---------- sub-components ----------

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        <span className="text-[10px]">{label}</span>
      </div>
      <div className="text-sm font-mono font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const SQ_STATUS_META: Record<
  SubQuery["status"],
  { label: string; cls: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground", icon: Clock },
  searching: { label: "Searching", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", icon: Globe },
  reading: { label: "Reading", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300", icon: BookOpen },
  extracting: { label: "Extracting", cls: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300", icon: Sparkles },
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", icon: Check },
  failed: { label: "Failed", cls: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

function SubQueryCard({ index, sq }: { index: number; sq: SubQuery }) {
  const meta = SQ_STATUS_META[sq.status];
  const Icon = meta.icon;
  const isActive =
    sq.status === "searching" || sq.status === "reading" || sq.status === "extracting";

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
              sq.round === 2
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-primary/15 text-primary"
            )}
          >
            {index + 1}
          </span>
          {sq.round === 2 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] px-1 py-0 rounded">
              R2
            </Badge>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium leading-snug">{sq.question}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 gap-0.5 rounded-full", meta.cls)}>
              {isActive ? <Loader2 className="h-2 w-2 animate-spin" /> : <Icon className="h-2 w-2" />}
              {meta.label}
            </Badge>
            {sq.searchResults.length > 0 && (
              <span className="text-[9px] text-muted-foreground">{sq.searchResults.length} results</span>
            )}
            {sq.pagesRead > 0 && (
              <span className="text-[9px] text-muted-foreground">· {sq.pagesSucceeded}/{sq.pagesRead} read</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function dedupeSources(sources: { url: string; title: string; host: string }[]) {
  const seen = new Set<string>();
  const out: { url: string; title: string; host: string }[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

function LiveActivity({ logs }: { logs: LogEntry[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const recent = logs.slice(-30);
  return (
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
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.ts).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const colors: Record<LogEntry["level"], string> = {
    info: "text-muted-foreground",
    warn: "text-amber-600 dark:text-amber-400",
    error: "text-destructive",
    success: "text-emerald-600 dark:text-emerald-400",
  };
  const prefix: Record<LogEntry["level"], string> = {
    info: "•",
    warn: "!",
    error: "✗",
    success: "✓",
  };
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/50 shrink-0">{time}</span>
      <span className={cn("shrink-0", colors[entry.level])}>{prefix[entry.level]}</span>
      <span className={cn("break-words", colors[entry.level])}>{entry.message}</span>
    </div>
  );
}
