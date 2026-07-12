"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Check,
  GitBranch,
  Link2,
  BookOpen,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResearchJob } from "@/lib/types";
import {
  STAGES,
  STAGE_ORDER,
  stageMeta,
  stageProgress,
  fmtTime,
  fmtNum,
} from "@/lib/research-ui-utils";

interface ResearchStatusProps {
  job: ResearchJob;
  isRunning: boolean;
  onReset: () => void;
}

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

export function ResearchStatus({ job, isRunning, onReset }: ResearchStatusProps) {
  return (
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
              onClick={onReset}
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
  );
}
