"use client";

// ResearchCard — a single deep research card in the unified interface.
// Takes a query, auto-starts the research pipeline (plan → search →
// synthesize), shows progress, then the final report.

import { motion } from "framer-motion";
import { Search, Square, CheckCircle2, AlertCircle } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { useResearchFlow } from "@/hooks/useResearchFlow";
import { ReportViewer } from "@/components/research/ReportViewer";
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

export const ResearchCard = React.memo(function ResearchCard({ query, onStop }: ResearchCardProps) {
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
      className="rounded-3xl border border-[#d9d4c7] dark:border-[#3d3830] overflow-hidden bg-[#faf8f3] dark:bg-[#1c1a17]"
    >
      {/* Query header */}
      <div className="bg-[#faf8f3] dark:bg-[#1c1a17] px-5 py-3 border-b border-[#d9d4c7] dark:border-[#3d3830] flex items-start gap-2">
        <Search className="h-4 w-4 shrink-0 mt-0.5 text-[#8b4513]" />
        <p className="text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8] flex-1">{query}</p>
        {isRunning && (
          <button
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[#a33a3a]/30 px-3 py-1.5 text-xs text-[#a33a3a] hover:bg-[#a33a3a]/5 transition-colors"
          >
            <Square className="h-3 w-3" />
            {t("stop")}
          </button>
        )}
        {phase === "done" && (
          <CheckCircle2 className="h-4 w-4 text-[#8b4513] shrink-0" />
        )}
        {phase === "failed" && (
          <AlertCircle className="h-4 w-4 text-[#a33a3a] shrink-0" />
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Planning phase */}
        {phase === "planning" && <PlanPreviewLoading />}

        {/* Error */}
        {phase === "failed" && error && (
          <div className="rounded-xl border border-[#a33a3a]/30 bg-[#a33a3a]/5 p-3 text-sm text-[#a33a3a]">
            {error}
          </div>
        )}

        {/* Researching / done */}
        {job && (phase === "researching" || phase === "done") && (
          <>
            {/* Compact progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6b6358] dark:text-[#9a9080]">
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
              <div className="relative h-1.5 rounded-full bg-[#d9d4c7] dark:bg-[#322e28] overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                    job.status === "failed" ? "bg-[#a33a3a]" : "bg-[#8b4513]"
                  )}
                  style={{ width: `${stageProgress(job.status)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#6b6358] font-mono">
                {t("pagesRead")} {job.stats.totalPagesRead} {t("pages")}
                {job.stats.totalPagesSucceeded > 0 && ` (${job.stats.totalPagesSucceeded} usable)`}
                {job.stats.roundsCompleted > 0 && ` · ${job.stats.roundsCompleted} round${job.stats.roundsCompleted > 1 ? "s" : ""}`}
                {job.stats.elapsedMs ? ` · ${fmtTime(job.stats.elapsedMs)}` : ""}
                {job.stats.llmCalls > 0 && ` · ${job.stats.llmCalls} LLM calls`}
                {job.stats.estimatedCost > 0
                  ? ` · $${job.stats.estimatedCost.toFixed(4)}`
                  : " · $0.00 (free)"}
              </p>

              {/* Citation verification badge */}
              {job.verificationReport && job.verificationReport.total > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {job.verificationReport.unverified === 0 && job.verificationReport.contradicts === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#8b4513]/10 text-[#8b4513] px-2 py-0.5 font-medium">
                      ✓ {job.verificationReport.verified}/{job.verificationReport.total} citations verified
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a574]/15 text-[#a37a3f] dark:text-[#d4a574] px-2 py-0.5 font-medium">
                        ⚠ {job.verificationReport.unverified} unverified / {job.verificationReport.total} total
                      </span>
                      {job.verificationReport.contradicts > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[#a33a3a]/10 text-[#a33a3a] px-2 py-0.5 font-medium"
                          title={job.verificationReport.warnings?.join("\n\n")}
                        >
                          ✕ {job.verificationReport.contradicts} contradiction{job.verificationReport.contradicts === 1 ? "" : "s"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Plan preview (collapsible) */}
            {job.plan && (
              <Collapsible open={planExpanded} onOpenChange={setPlanExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-[#8b4513] hover:underline">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", planExpanded && "rotate-180")} />
                  {job.plan.title} ({job.plan.sections.length} sections)
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-xs text-[#6b6358] dark:text-[#9a9080] space-y-1">
                  <p className="font-medium text-[#2a2620] dark:text-[#e8e3d8]">{job.plan.summary}</p>
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
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-[#6b6358] dark:text-[#9a9080] hover:text-[#2a2620] dark:hover:text-[#e8e3d8]">
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

);
