"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/types";
import { LogLine } from "./ReportViewer";

// modal version
// Triggered by "Technical details" button in the main UI.

interface ActivityLogModalProps {
  logs: LogEntry[];
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

export function ActivityLogModal({ logs, open, onOpenChange }: ActivityLogModalProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <Card
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-0 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
            <h3 className="text-sm font-semibold">Technical details</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Logs */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1"
          >
            {logs.length === 0 && (
              <p className="text-muted-foreground italic">No logs yet.</p>
            )}
            {logs.map((l, i) => (
              <LogLine key={i} entry={l} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
