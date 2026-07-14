"use client";

// ResearchCard — a single deep research card in the unified interface.
// Takes a query, auto-starts the research pipeline (plan → search →
// synthesize), shows progress, then the final report.

import { motion } from "framer-motion";
import { Search, Square, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";
import { useResearchFlow } from "@/hooks/useResearchFlow";
import { ReportViewer } from "@/components/research/ReportViewer";
import { ResearchStatus } from "@/components/research/ResearchStatus";
import { SubQueryList } from "@/components/research/SubQueryList";
import { LiveActivity } from "@/components/research/ReportViewer";
import { PlanPreviewLoading } from "@/components/research/PlanPreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { stageProgress, fmtTime } from "@/lib/research-ui-utils";
import { cn } from "@/lib/utils";

interface ResearchCardProps {
  query: string;
  onStop?: () => void;
}

export function ResearchCard({ query, onStop }: ResearchCardProps) {
  const t = useT();
  const { phase, job, streamingReport, error, stop } = useResearchFlow(query);
  const [planExpanded, setPlanExpanded] = React.useState(false);
  const [activityExpanded, setActivityExpanded] = React.useState(false);

  const isRunning = phase === "planning" || phase === "researching";

  async function handleStop() {
    await stop();
    onStop?.();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 shadow-sm overflow-hidden"
    >
      {/* Query header */}
      <div className="bg-secondary/50 px-5 py-3 flex items-start gap-2">
        <Search className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p className="text-sm font-medium text-foreground flex-1">{query}</p>
        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStop}
            className="gap-1.5 text-xs rounded-full text-destructive hover:text-destructive shrink-0"
          >
            <Square className="h-3 w-3" />
            {t("stop")}
          </Button>
        )}
        {phase === "done" && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
        {phase === "failed" && (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Planning phase */}
        {phase === "planning" && <PlanPreviewLoading />}

        {/* Error */}
        {phase === "failed" && error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Researching / done */}
        {job && (phase === "researching" || phase === "done") && (
          <>
            {/* Compact progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {isRunning
                    ? job.status === "planning"
                      ? t("planning") + "..."
                      : job.status === "synthesizing"
                        ? t("writing") + "..."
                        : t("researching") + "..."
                    : t("done")}
                </span>
                <span className="font-mono tabular-nums">{stageProgress(job.status)}%</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                    job.status === "failed" ? "bg-destructive" : "bg-brand-gradient"
                  )}
                  style={{ width: `${stageProgress(job.status)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t("pagesRead")} {job.stats.totalPagesRead} {t("pages")}
                {job.stats.totalPagesSucceeded > 0 && ` (${job.stats.totalPagesSucceeded} usable)`}
                {job.stats.roundsCompleted > 0 && ` · ${job.stats.roundsCompleted} round${job.stats.roundsCompleted > 1 ? "s" : ""}`}
                {job.stats.elapsedMs ? ` · ${fmtTime(job.stats.elapsedMs)}` : ""}
              </p>
            </div>

            {/* Plan preview (collapsible) */}
            {job.plan && (
              <Collapsible open={planExpanded} onOpenChange={setPlanExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", planExpanded && "rotate-180")} />
                  {job.plan.title} ({job.plan.sections.length} sections)
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">{job.plan.summary}</p>
                  {job.plan.sections.map((s, i) => (
                    <p key={s.id} className="pl-2">• {i + 1}. {s.title}</p>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Sub-queries */}
            {job.subQueries.length > 0 && <SubQueryList subQueries={job.subQueries} />}

            {/* Live activity (collapsible) */}
            {job.logs.length > 0 && (
              <Collapsible open={activityExpanded} onOpenChange={setActivityExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", activityExpanded && "rotate-180")} />
                  {t("liveActivity")} ({job.logs.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <LiveActivity logs={job.logs} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Report (streaming or final) */}
            {(streamingReport || job.report) && (
              <ReportViewer
                report={job.report || streamingReport}
                copied={false}
                onCopy={() => {}}
                onDownload={() => {}}
                streaming={phase === "researching" && !job.report}
              />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
