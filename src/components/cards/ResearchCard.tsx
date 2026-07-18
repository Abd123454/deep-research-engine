"use client";

// ResearchCard — a single deep research card in the unified interface.
// Takes a query, auto-starts the research pipeline (plan → search →
// synthesize), shows progress, then the final report.

import { motion } from "framer-motion";
import { Search, Square, CheckCircle2, AlertCircle, Leaf, Lightbulb, AlertTriangle } from "lucide-react";
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
import { estimateResearchCarbon, formatCarbon, inferModelSize } from "@/lib/carbon-footprint";
import {
  getCriticalThinkingPrompt,
  shouldShowCriticalThinkingPrompt,
} from "@/lib/critical-thinking";

interface ResearchCardProps {
  query: string;
  onStop?: () => void;
}

export const ResearchCard = React.memo(function ResearchCard({ query, onStop }: ResearchCardProps) {
  const t = useT();
  const { phase, job, streamingReport, error, stop } = useResearchFlow(query);
  const [planExpanded, setPlanExpanded] = React.useState(false);
  const [activityExpanded, setActivityExpanded] = React.useState(false);
  const [limitationsExpanded, setLimitationsExpanded] = React.useState(false);

  // Critical-thinking prompt — set ONCE when the research completes.
  // Uses useState lazy initializer + a ref guard so we don't reshuffle
  // the prompt on every re-render (the gating function returns true
  // for "research", so this WILL show — unlike in ChatCard).
  const [criticalThinkingPrompt] = React.useState<string | null>(() =>
    shouldShowCriticalThinkingPrompt("research") ? getCriticalThinkingPrompt() : null
  );

  const isRunning = phase === "planning" || phase === "researching";

  // Carbon footprint estimate — computed once the job is done.
  // Research defaults to "large" model size (the smart chain's first model
  // is meta/llama-3.1-70b-instruct). When NEXT_PUBLIC_LLM_PROVIDER=ollama,
  // the LLM emissions drop to 0 (local inference).
  const carbonEstimate = React.useMemo(() => {
    if (phase !== "done" || !job) return null;
    const local = process.env.NEXT_PUBLIC_LLM_PROVIDER === "ollama";
    return estimateResearchCarbon({
      tokensGenerated: job.stats.outputTokens || job.stats.totalTokensUsed,
      pagesRead: job.stats.totalPagesRead,
      searchQueries: job.subQueries.length,
      modelSize: inferModelSize("meta/llama-3.1-70b-instruct"),
      local,
    });
  }, [phase, job]);

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
                // P0-8: pass sources + verification report so [N] citations
                // in the report become interactive hover cards. While the
                // report is streaming we pass `sources` anyway — the
                // hover cards are inert until ReactMarkdown renders the
                // final report (the streaming branch uses a <pre>, not
                // ReactMarkdown, so citations stay as plain text).
                sources={job.sources}
                verificationReport={job.verificationReport ?? null}
              />
            )}
          </>
        )}

        {/* Carbon footprint indicator — shown when the job is done.
            Quaesitor palette: text-[#6b6358] (faded ink), Leaf icon. */}
        {phase === "done" && carbonEstimate && (
          <div
            className="flex items-center gap-1.5 pt-3 mt-2 border-t border-[#d9d4c7]/60 dark:border-[#3d3830]/60 text-[11px] text-[#6b6358] dark:text-[#9a9080] font-ui"
            title={
              carbonEstimate.local
                ? "Local inference (Ollama) — 0g remote CO₂. See docs/ENVIRONMENTAL.md."
                : `Estimated CO₂ breakdown:\n${carbonEstimate.breakdown
                    .map((b) => `  ${b.category}: ${b.grams}g`)
                    .join("\n")}\n\nSee docs/ENVIRONMENTAL.md.`
            }
          >
            <Leaf className="h-3 w-3 shrink-0" />
            <span>
              {carbonEstimate.local
                ? "0g CO₂ (local)"
                : `${formatCarbon(carbonEstimate.grams)} estimated`}
              {" · "}
              <span className="underline-offset-2 hover:underline cursor-help">
                See impact
              </span>
            </span>
          </div>
        )}

        {/* Critical-thinking prompt — Quaesitor's signature nudge toward
            intellectual humility. Shown after the report completes.
            One prompt per report (random from the pool), stable across
            re-renders. Warm, italic, muted — not a callout. */}
        {phase === "done" && criticalThinkingPrompt && (
          <div className="mt-3 flex items-start gap-2 px-1">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#8b4513] dark:text-[#b5673a]" aria-hidden="true" />
            <p className="text-xs italic font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed">
              <span className="font-medium not-italic">Critical thinking:</span>{" "}
              {criticalThinkingPrompt}
            </p>
          </div>
        )}

        {/* Known limitations — collapsible honesty section.
            Quaesitor models intellectual humility: every report
            explicitly lists what it CANNOT guarantee. This builds
            trust and reminds readers that AI research is a starting
            point, not a final answer. */}
        {phase === "done" && job && (
          <Collapsible open={limitationsExpanded} onOpenChange={setLimitationsExpanded} className="mt-3">
            <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-[#6b6358] dark:text-[#9a9080] hover:text-[#2a2620] dark:hover:text-[#e8e3d8] transition-colors py-1">
              <AlertTriangle className="h-3 w-3 shrink-0 text-[#a37a3f] dark:text-[#d4a574]" />
              <span className="font-ui font-medium">Known limitations of this report</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform ml-auto", limitationsExpanded && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-1.5 text-[11px] font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed pl-1">
                <li className="flex gap-1.5">
                  <span className="text-[#a37a3f] dark:text-[#d4a574] shrink-0">•</span>
                  <span>
                    Sources are predominantly from English-language, Western-indexed
                    web. Perspectives from the Global South, non-English scholarship,
                    and oral traditions may be underrepresented.
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#a37a3f] dark:text-[#d4a574] shrink-0">•</span>
                  <span>
                    Citation verification checks URL reachability and basic
                    contradiction — it does <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8]">not</strong> verify
                    factual accuracy. A "verified" citation means the URL exists and
                    the cited text appears in it, not that the claim is true.
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#a37a3f] dark:text-[#d4a574] shrink-0">•</span>
                  <span>
                    {job.verificationReport && job.verificationReport.total > 0 ? (
                      <>
                        The citation verifier flagged{" "}
                        <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8]">
                          {job.verificationReport.unverified} unverified
                        </strong>{" "}
                        and{" "}
                        <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8]">
                          {job.verificationReport.contradicts} contradicting
                        </strong>{" "}
                        citation{job.verificationReport.contradicts === 1 ? "" : "s"}.
                        Review them in the citation badge above.
                      </>
                    ) : (
                      <>No citation verification was performed for this report.</>
                    )}
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#a37a3f] dark:text-[#d4a574] shrink-0">•</span>
                  <span>
                    This report was generated in{" "}
                    <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8] font-mono">
                      {job.stats.elapsedMs ? fmtTime(job.stats.elapsedMs) : "—"}
                    </strong>
                    . Deeper investigation — additional search rounds, expert
                    consultation, primary-source review — may yield further insights.
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#a37a3f] dark:text-[#d4a574] shrink-0">•</span>
                  <span>
                    The <code className="font-mono text-[10px] bg-[#d9d4c7]/60 dark:bg-[#322e28]/60 px-1 py-0.5 rounded">bias_auditor</code>{" "}
                    agent reviewed this output for cultural, geographic, and
                    linguistic biases, but bias mitigation is not elimination.
                    Seek additional perspectives before relying on this report for
                    consequential decisions.
                  </span>
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </motion.div>
  );
}

);
