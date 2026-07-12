// Shared UI utilities and constants for the research components.
// Extracted from the monolithic deep-research.tsx to enable reuse across
// the split components.

import {
  FileText,
  Globe,
  BookOpen,
  Sparkles,
  Target,
  ListTree,
  GitBranch,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import type {
  ResearchStatus,
  SubQuery,
  LogEntry,
} from "@/lib/types";

// ---------- Stage metadata ----------

export const STAGES: {
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

export const STAGE_ORDER: ResearchStatus[] = STAGES.map((s) => s.key);

export function stageMeta(status: ResearchStatus) {
  return STAGES.find((s) => s.key === status);
}

export function stageProgress(status: ResearchStatus): number {
  if (status === "failed") return 100;
  if (status === "queued") return 0;
  if (status === "completed") return 100;
  const idx = STAGE_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.min(99, Math.round(((idx + 0.5) / STAGE_ORDER.length) * 100));
}

// ---------- Sub-query status metadata ----------

export const SQ_STATUS_META: Record<
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

// ---------- Formatting helpers ----------

export function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString();
}

// ---------- Source deduplication ----------

export function dedupeSources(sources: { url: string; title: string; host: string }[]) {
  const seen = new Set<string>();
  const out: { url: string; title: string; host: string }[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

// ---------- Log line colors ----------

export const LOG_COLORS: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
  success: "text-emerald-600 dark:text-emerald-400",
};

export const LOG_PREFIX: Record<LogEntry["level"], string> = {
  info: "•",
  warn: "!",
  error: "✗",
  success: "✓",
};
