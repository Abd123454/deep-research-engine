"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  FileSearch,
  Brain,
  Layers,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/research-ui-utils";

const MAX_QUERY_CHARS = 100_000;

const EXAMPLES = [
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

interface ResearchInputProps {
  query: string;
  setQuery: (q: string) => void;
  depth: "standard" | "deep" | "advanced";
  applyDepth: (d: "standard" | "deep" | "advanced") => void;
  numSubQueries: number;
  setNumSubQueries: (n: number) => void;
  maxLinks: number;
  setMaxLinks: (n: number) => void;
  reportTokens: number;
  setReportTokens: (n: number) => void;
  showSettings: boolean;
  setShowSettings: (b: boolean) => void;
  starting: boolean;
  startResearch: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ResearchInput({
  query,
  setQuery,
  depth,
  applyDepth,
  numSubQueries,
  setNumSubQueries,
  maxLinks,
  setMaxLinks,
  reportTokens,
  setReportTokens,
  showSettings,
  setShowSettings,
  starting,
  startResearch,
  textareaRef,
}: ResearchInputProps) {
  const charCount = query.length;
  const isOverLimit = charCount > MAX_QUERY_CHARS;
  const isGiant = charCount > 4000;
  const isMega = charCount > 15000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* ---------- Greeting (simple, no gradient) ---------- */}
      <div className="text-center max-w-2xl mx-auto pt-8 sm:pt-16 pb-3">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Hello
        </h2>
        <p className="mt-2 text-muted-foreground text-base sm:text-lg">
          What should we research today?
        </p>
      </div>

      {/* ---------- Input box (Gemini-style: gray bg, no border) ---------- */}
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-secondary shadow-sm transition-shadow focus-within:shadow-md">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your research question or paste a brief..."
            className="min-h-[100px] resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                startResearch();
              }
            }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
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
                  isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground/50"
                )}
              >
                {fmtNum(charCount)} / {fmtNum(MAX_QUERY_CHARS)}
              </span>
              <Button
                onClick={startResearch}
                disabled={starting || !query.trim() || isOverLimit}
                size="icon"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 border-0"
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
      </div>

      {/* Suggestion chips — simple, no animation */}
      <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setQuery(ex.text)}
            className="group flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <ex.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[13px] leading-snug text-muted-foreground group-hover:text-foreground">
              {ex.text}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
