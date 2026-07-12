"use client";

import * as React from "react";
import { Hash, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { LogEntry } from "@/lib/types";
import { LogLine } from "./ReportViewer";

interface ActivityLogProps {
  logs: LogEntry[];
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

export function ActivityLog({ logs, open, onOpenChange }: ActivityLogProps) {
  if (logs.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="border-border/70 shadow-sm">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              Activity log
              <Badge variant="secondary" className="text-[10px] rounded-full">
                {logs.length}
              </Badge>
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="max-h-80 overflow-y-auto p-4 font-mono text-[11px] space-y-1">
            {logs.map((l, i) => (
              <LogLine key={i} entry={l} />
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
