"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Check,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResearchJob, ResearchStatus as RStatus } from "@/lib/types";
import { stageProgress, fmtTime } from "@/lib/research-ui-utils";
import { useT } from "@/components/i18n/locale-provider";

// simplified progress + 3-state progress + 1 status line
const useStages = () => {
  const t = useT();
  return [
    { key: "planning", label: t("planning") },
    { key: "researching", label: t("researching") },
    { key: "writing", label: t("writing") },
  ];
};

// Map the 7 internal stages to the 3 visible ones.
function getSimpleStage(status: RStatus): number {
  switch (status) {
    case "planning":
    case "decomposing":
      return 0; // Planning
    case "searching":
    case "reading":
    case "extracting":
    case "analyzing_gaps":
      return 1; // Researching
    case "synthesizing":
      return 2; // Writing
    default:
      return 0;
  }
}

interface ResearchStatusProps {
  job: ResearchJob;
  isRunning: boolean;
  onReset: () => void;
}

export function ResearchStatus({ job, isRunning, onReset }: ResearchStatusProps) {
  const t = useT();
  const SIMPLE_STAGES = useStages();
  const simpleStage = getSimpleStage(job.status);
  const elapsed = job.stats.elapsedMs || Date.now() - (job.startedAt || Date.now());

  return (
    <Card className="overflow-hidden border-border/70 shadow-lg shadow-primary/5">
      <CardContent className="p-5 space-y-4">
        {/* Top row: status label + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : job.status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="text-xs font-medium">
                {job.status === "completed"
                  ? t("done")
                  : job.status === "failed"
                    ? job.error === "Cancelled by user"
                      ? t("cancel")
                      : t("cancel")
                    : SIMPLE_STAGES[simpleStage]!.label}
              </span>
              <Badge variant="outline" className="text-[10px] rounded-full">
                {job.config.depth}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {job.query}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5 shrink-0 rounded-full"
          >
            <RefreshCw className="h-3 w-3" />
            {t("new")}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {isRunning ? SIMPLE_STAGES[simpleStage]!.label + "..." : t("done")}
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

        {/* 3-state progress (replaces 7 stage chips) */}
        <div className="flex items-center gap-2">
          {SIMPLE_STAGES.map((s, i) => {
            const active = i === simpleStage && isRunning;
            const done = i < simpleStage || job.status === "completed";
            return (
              <React.Fragment key={s.key}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : done
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground/50"
                  )}
                >
                  {active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-current" />
                  )}
                  {s.label}
                </div>
                {i < SIMPLE_STAGES.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      done ? "bg-emerald-500/30" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Single status line (replaces 4 stat pills) */}
        <p className="text-[11px] text-muted-foreground font-mono">
          {t("pagesRead")} {job.stats.totalPagesRead} {t("pages")}
          {job.stats.totalPagesSucceeded > 0 && ` (${job.stats.totalPagesSucceeded} usable)`}
          {job.stats.roundsCompleted > 0 && ` · ${job.stats.roundsCompleted} round${job.stats.roundsCompleted > 1 ? "s" : ""}`}
          {" · "}
          {fmtTime(elapsed)}
        </p>
      </CardContent>
    </Card>
  );
}
