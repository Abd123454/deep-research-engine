"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Lightbulb,
  FileSearch,
  Brain,
  Layers,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  starting: boolean;
  startResearch: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ResearchInput({
  query,
  setQuery,
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

          {/* Bottom bar — Gemini-style: just the send button. No settings. */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
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
