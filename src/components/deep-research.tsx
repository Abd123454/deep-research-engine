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
  Brain,
  Globe,
  BookOpen,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Hash,
  Layers,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  ResearchJob,
  ResearchStatus,
  SubQuery,
  LogEntry,
} from "@/lib/types";

// ---------- helpers ----------

const STAGE_META: Record<
  ResearchStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  queued: { label: "Queued", icon: Clock, color: "text-muted-foreground" },
  decomposing: { label: "Decomposing Query", icon: Brain, color: "text-amber-500" },
  searching: { label: "Searching the Web", icon: Search, color: "text-sky-500" },
  reading: { label: "Reading Pages", icon: BookOpen, color: "text-violet-500" },
  extracting: { label: "Extracting Findings", icon: Sparkles, color: "text-fuchsia-500" },
  synthesizing: { label: "Writing Report", icon: FileText, color: "text-emerald-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-emerald-600" },
  failed: { label: "Failed", icon: AlertCircle, color: "text-destructive" },
};

const STAGE_ORDER: ResearchStatus[] = [
  "decomposing",
  "searching",
  "reading",
  "extracting",
  "synthesizing",
  "completed",
];

function stageProgress(status: ResearchStatus): number {
  if (status === "failed") return 100;
  if (status === "queued") return 0;
  const idx = STAGE_ORDER.indexOf(status);
  if (idx < 0) return 0;
  // Each stage = ~16.6% (6 stages). Add half a stage so it feels live.
  return Math.min(100, Math.round(((idx + 0.5) / STAGE_ORDER.length) * 100));
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
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

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea to fit large prompts (up to a cap).
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, 160), 640);
    el.style.height = `${newHeight}px`;
  }, [query]);

  const charCount = query.length;
  const charPct = Math.min(100, (charCount / MAX_QUERY_CHARS) * 100);
  const isOverLimit = charCount > MAX_QUERY_CHARS;
  const isGiant = charCount > 4000;
  const isMega = charCount > 15000;

  function fmtNum(n: number): string {
    return n.toLocaleString();
  }

  const [job, setJob] = React.useState<ResearchJob | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);

  const stopPollingRef = React.useRef(false);

  // Apply depth presets.
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
        config?: { llmProvider: string; retriever: string };
      };
      if (!res.ok || !data.ok || !data.id) {
        throw new Error(data.error || "Failed to start research.");
      }
      toast.success("Research started!", {
        description: `LLM: ${data.config?.llmProvider} · Retriever: ${data.config?.retriever}`,
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
          // Job may have been evicted from the in-memory store (TTL/capacity).
          // After a few consecutive 404s, give up gracefully.
          if (consecutive404 >= 3) {
            setPolling(false);
            toast.error("Research job was evicted from memory", {
              description:
                "The job ran for too long and was cleaned up. Try again with a smaller scope or shallower depth.",
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
                  description: `Read ${data.job.stats.totalPagesRead} pages in ${fmtTime(
                    data.job.stats.elapsedMs
                  )}.`,
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
        // Network blips: keep polling but slow down.
        console.error("poll error", err);
      }
      await new Promise((r) => setTimeout(r, interval));
      // Adaptive polling: speed up during active stages, slow down when idle.
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

  const isRunning =
    job &&
    job.status !== "completed" &&
    job.status !== "failed";

  const examples = [
    "What are the latest breakthroughs in solid-state battery technology and their commercialization timeline?",
    "Compare the architectural differences and performance trade-offs between RISC-V and ARM processors.",
    "What is the current state of quantum error correction and when might fault-tolerant quantum computers arrive?",
    "How do large language model agents work, and what are the main agentic frameworks in 2025?",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Deep Research</h1>
              <p className="text-xs text-muted-foreground leading-tight">
                AI-Powered Deep Search Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              <Sparkles className="h-3 w-3 mr-1" />
              Z.AI + NVIDIA Ready
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ---------- Main ---------- */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        {!job && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Hero */}
            <div className="text-center max-w-3xl mx-auto pt-4 pb-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Ask once. Get a{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  comprehensive report
                </span>
                .
              </h2>
              <p className="mt-3 text-muted-foreground text-base sm:text-lg">
                This engine decomposes your question into focused sub-queries,
                searches the web, reads dozens of pages, extracts findings, and
                writes a long-form report with citations.
              </p>
            </div>

            {/* Input */}
            <Card className="shadow-sm">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="query" className="text-sm font-medium">
                      Research Query / Brief
                    </Label>
                    <div className="flex items-center gap-2">
                      {isGiant && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] gap-1",
                            isMega
                              ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {isMega ? "Mega prompt" : "Large prompt"}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                        }}
                          disabled={!query}
                          className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <Textarea
                    id="query"
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      "Write your research question OR paste a giant research brief.\n\n" +
                      "Tip: you can paste up to 100,000 characters (≈25,000 tokens) of detailed instructions, multi-section requirements, RFPs, or context. The engine will detect large prompts and adapt its decomposition strategy to cover every aspect."
                    }
                    className="resize-y text-base leading-relaxed font-mono min-h-[160px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        startResearch();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Press <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">⌘/Ctrl + Enter</kbd> to start. Paste long briefs freely.
                    </p>
                    <div className="flex items-center gap-2 min-w-[140px] justify-end">
                      <div className="w-20 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            isOverLimit
                              ? "bg-destructive"
                              : isMega
                                ? "bg-fuchsia-500"
                                : isGiant
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                          )}
                          style={{ width: `${charPct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-mono tabular-nums",
                          isOverLimit
                            ? "text-destructive font-semibold"
                            : "text-muted-foreground"
                        )}
                      >
                        {fmtNum(charCount)} / {fmtNum(MAX_QUERY_CHARS)}
                      </span>
                    </div>
                  </div>
                  {isOverLimit && (
                    <p className="text-xs text-destructive">
                      Query exceeds the {fmtNum(MAX_QUERY_CHARS)} character limit. Please shorten it.
                    </p>
                  )}
                </div>

                {/* Quick examples */}
                <div className="flex flex-wrap gap-2">
                  {examples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(ex)}
                      className="text-xs px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-left max-w-full truncate"
                      title={ex}
                    >
                      {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
                    </button>
                  ))}
                </div>

                {/* Settings */}
                <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        {showSettings ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        Advanced Settings
                      </Button>
                    </CollapsibleTrigger>
                    <Badge variant="outline" className="text-xs">
                      Depth: {depth}
                    </Badge>
                  </div>
                  <CollapsibleContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Search Depth</Label>
                        <Select
                          value={depth}
                          onValueChange={(v) =>
                            applyDepth(v as "standard" | "deep" | "advanced")
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (fast)</SelectItem>
                            <SelectItem value="deep">Deep</SelectItem>
                            <SelectItem value="advanced">Advanced (max)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sub-queries: {numSubQueries}</Label>
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
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Links / query: {maxLinks}</Label>
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
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Report tokens: {reportTokens}</Label>
                        <Input
                          type="number"
                          min={1000}
                          max={32000}
                          step={1000}
                          value={reportTokens}
                          onChange={(e) =>
                            setReportTokens(
                              Math.min(
                                32000,
                                Math.max(1000, parseInt(e.target.value) || 1000)
                              )
                            )
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 space-y-1">
                      <p>
                        💡 <strong>Advanced</strong> uses ~{numSubQueries} sub-queries × {maxLinks} links =
                        up to {numSubQueries * maxLinks} pages read.
                      </p>
                      <p>
                        📝 <strong>Giant prompts</strong> (4K+ chars) automatically get enhanced decomposition
                        with more output tokens; <strong>mega prompts</strong> (15K+) get the highest budget.
                      </p>
                      <p>
                        📊 Final report cap: ~{fmtNum(reportTokens)} tokens. Raise it for even longer reports.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    onClick={startResearch}
                    disabled={starting || !query.trim() || isOverLimit}
                    className="flex-1 h-11 text-base"
                    size="lg"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Start Deep Research
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Feature strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: Layers,
                  title: "Multi-stage pipeline",
                  desc: "Decompose → Search → Read → Extract → Synthesize",
                },
                {
                  icon: Globe,
                  title: "Real web sources",
                  desc: "Free Z.AI web_search + page_reader, or bring your Tavily key",
                },
                {
                  icon: FileText,
                  title: "Long-form report",
                  desc: "Up to 32K-token comprehensive report with inline citations",
                },
              ].map((f, i) => (
                <Card key={i} className="shadow-none">
                  <CardContent className="p-4">
                    <f.icon className="h-5 w-5 text-emerald-600 mb-2" />
                    <h3 className="text-sm font-medium">{f.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* ---------- Job view ---------- */}
        {job && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* Top status bar */}
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                      ) : job.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium">
                        {STAGE_META[job.status].label}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {job.config.depth}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      <span className="font-medium text-foreground">Query:</span>{" "}
                      {job.query}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isRunning ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={reset}
                        className="gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        New
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={reset}
                        className="gap-1.5"
                      >
                        <Search className="h-3.5 w-3.5" />
                        New Research
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {isRunning ? "Research in progress..." : "Done"}
                    </span>
                    <span className="font-mono">
                      {stageProgress(job.status)}%
                    </span>
                  </div>
                  <Progress
                    value={stageProgress(job.status)}
                    className={cn(
                      "h-2",
                      job.status === "failed" && "[&>div]:bg-destructive"
                    )}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <StatCard
                    icon={Layers}
                    label="Sub-queries"
                    value={`${job.stats.subQueriesCompleted}/${job.subQueries.length}`}
                  />
                  <StatCard
                    icon={Link2}
                    label="Pages found"
                    value={String(job.stats.totalPagesFound)}
                  />
                  <StatCard
                    icon={BookOpen}
                    label="Pages read"
                    value={`${job.stats.totalPagesSucceeded}/${job.stats.totalPagesRead}`}
                  />
                  <StatCard
                    icon={Clock}
                    label="Elapsed"
                    value={fmtTime(job.stats.elapsedMs || Date.now() - (job.startedAt || Date.now()))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Two-column layout on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Left: sub-queries + sources */}
              <div className="lg:col-span-2 space-y-4">
                {/* Sub-queries */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      Sub-queries
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {job.subQueries.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        Generating sub-questions...
                      </p>
                    )}
                    {job.subQueries.map((sq, i) => (
                      <SubQueryCard key={sq.id} index={i} sq={sq} />
                    ))}
                  </CardContent>
                </Card>

                {/* Sources */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-emerald-600" />
                      Sources
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {job.sources.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {job.sources.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No sources collected yet.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                        {dedupeSources(job.sources).slice(0, 50).map((s, i) => (
                          <a
                            key={s.url + i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <Hash className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium line-clamp-1 group-hover:text-emerald-600">
                                  {s.title || s.url}
                                </p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">
                                  {s.host}
                                </p>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: report or logs */}
              <div className="lg:col-span-3 space-y-4">
                {job.report ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-600" />
                          Final Report
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyReport}
                            className="h-7 gap-1"
                          >
                            {copied ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadReport}
                            className="h-7 gap-1"
                          >
                            <Download className="h-3 w-3" />
                            .md
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-emerald-600 hover:prose-a:text-emerald-700 prose-pre:bg-muted prose-pre:text-foreground">
                        <ReactMarkdown>{job.report}</ReactMarkdown>
                      </article>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Live Activity
                      </CardTitle>
                      <CardDescription className="text-xs">
                        The report will appear here once synthesis completes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <LiveActivity logs={job.logs} />
                    </CardContent>
                  </Card>
                )}

                {/* Logs (collapsible) */}
                {job.logs.length > 0 && (
                  <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
                    <Card>
                      <CardHeader className="pb-3">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between h-8"
                          >
                            <span className="flex items-center gap-2 text-xs font-medium">
                              <Hash className="h-3.5 w-3.5" />
                              Activity Log ({job.logs.length})
                            </span>
                            {logsOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] space-y-1">
                            {job.logs.map((l, i) => (
                              <LogLine key={i} entry={l} />
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t mt-auto bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Built with Z.AI SDK · OpenAI-compatible NVIDIA NIM supported via{" "}
            <code className="px-1 py-0.5 rounded bg-muted">.env</code>
          </p>
          <p className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Deep Research Engine
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------- sub-components ----------

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="text-sm font-mono font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const SQ_STATUS_META: Record<
  SubQuery["status"],
  { label: string; cls: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    cls: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  searching: {
    label: "Searching",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    icon: Search,
  },
  reading: {
    label: "Reading",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    icon: BookOpen,
  },
  extracting: {
    label: "Extracting",
    cls: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    icon: Sparkles,
  },
  done: {
    label: "Done",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    cls: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
};

function SubQueryCard({ index, sq }: { index: number; sq: SubQuery }) {
  const meta = SQ_STATUS_META[sq.status];
  const Icon = meta.icon;
  const isActive = sq.status === "searching" || sq.status === "reading" || sq.status === "extracting";

  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="flex items-start gap-2">
        <div className="text-[11px] font-mono text-muted-foreground pt-0.5 shrink-0">
          Q{index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug">{sq.question}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", meta.cls)}>
              {isActive ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Icon className="h-2.5 w-2.5" />
              )}
              {meta.label}
            </Badge>
            {sq.searchResults.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {sq.searchResults.length} results
              </span>
            )}
            {sq.pagesRead > 0 && (
              <span className="text-[10px] text-muted-foreground">
                · {sq.pagesSucceeded}/{sq.pagesRead} read
              </span>
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

  const recent = logs.slice(-25);
  return (
    <div
      ref={containerRef}
      className="max-h-[500px] overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] space-y-1"
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
    warn: "text-amber-600",
    error: "text-destructive",
    success: "text-emerald-600",
  };
  const prefix: Record<LogEntry["level"], string> = {
    info: "•",
    warn: "!",
    error: "✗",
    success: "✓",
  };
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/60 shrink-0">{time}</span>
      <span className={cn("shrink-0", colors[entry.level])}>{prefix[entry.level]}</span>
      <span className={cn("break-words", colors[entry.level])}>{entry.message}</span>
    </div>
  );
}
