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
import { useT } from "@/components/i18n/locale-provider";
import { DocumentPicker } from "@/components/documents/DocumentPicker";
import { Paperclip, X } from "lucide-react";

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

interface AttachedDoc {
  id: string;
  filename: string;
  text: string;
}

interface ResearchInputProps {
  query: string;
  setQuery: (q: string) => void;
  starting: boolean;
  startResearch: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  attachedDocs?: AttachedDoc[];
  onAttachDoc?: (doc: { id: string; filename: string; preview: string }) => void;
  onDetachDoc?: (id: string) => void;
}

export function ResearchInput({
  query,
  setQuery,
  starting,
  startResearch,
  textareaRef,
  attachedDocs = [],
  onAttachDoc,
  onDetachDoc,
}: ResearchInputProps) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = React.useState(false);
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
      {/* greeting */}
      <div className="text-center max-w-2xl mx-auto pt-8 sm:pt-16 pb-3">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          {t("hello")}
        </h2>
        <p className="mt-2 text-muted-foreground text-base sm:text-lg">
          What should we research today?
        </p>
      </div>

      {/* input box */}
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-secondary transition-colors">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("enterQuery")}
            className="min-h-[100px] resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                startResearch();
              }
            }}
          />

          {/* bottom bar */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
              {onAttachDoc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Attach document"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="hidden sm:inline">Attach</span>
                  {attachedDocs.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-[#c96442]/20 dark:bg-[#d97757]/20 text-[#c96442] dark:text-[#d97757] text-[9px] px-1.5">
                      {attachedDocs.length}
                    </span>
                  )}
                </Button>
              )}
              {isGiant && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "rounded-full text-[10px] gap-1 px-2 py-0.5",
                    isMega
                      ? "bg-[#c96442]/10 dark:bg-[#d97757]/20 text-[#c96442] dark:text-[#d97757]"
                      : "bg-[#c96442]/10 dark:bg-[#d97757]/20 text-[#c96442] dark:text-[#d97757]"
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
                className="h-8 w-8 rounded-full bg-[#c96442] dark:bg-[#d97757] hover:bg-[#c96442]/90 dark:hover:bg-[#d97757]/90 border-0"
                aria-label={t("startResearch")}
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
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-[#c96442] dark:group-hover:bg-[#d97757] group-hover:text-primary-foreground transition-colors">
              <ex.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[13px] leading-snug text-muted-foreground group-hover:text-foreground">
              {ex.text}
            </span>
          </button>
        ))}
      </div>

      {/* Attached documents */}
      {attachedDocs.length > 0 && (
        <div className="mx-auto max-w-3xl flex flex-wrap gap-1.5">
          {attachedDocs.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#c96442]/10 dark:bg-[#d97757]/10 text-[#c96442] text-xs px-2.5 py-1"
            >
              <Paperclip className="h-3 w-3" />
              {d.filename}
              {onDetachDoc && (
                <button
                  onClick={() => onDetachDoc(d.id)}
                  aria-label={`Remove ${d.filename}`}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Document picker modal */}
      <DocumentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAttach={(doc) => onAttachDoc?.(doc)}
      />
    </motion.div>
  );
}
