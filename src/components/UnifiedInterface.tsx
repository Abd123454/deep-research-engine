"use client";

// UnifiedInterface — the single unified chat-like interface.
//
// Replaces the 4-tab sidebar architecture. All features (research, quick,
// documents, history) are accessible from one input bar. No mode switching
// needed — auto-detect handles it.
//
// Layout:
//   Header: logo + history toggle (☰) + lang + theme
//   Content: scrollable list of cards (current session)
//   Input bar (sticky bottom): UnifiedInput
//   History drawer (slide-in from right)

import * as React from "react";
import { Sparkles, Menu, Lightbulb, FileSearch, Brain, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useT } from "@/components/i18n/locale-provider";
import {
  UnifiedInput,
  detectCardType,
  type InputMode,
  type AttachedFile,
} from "@/components/input/UnifiedInput";
import { QuickCard } from "@/components/cards/QuickCard";
import { ResearchCard } from "@/components/cards/ResearchCard";
import { DocumentCard } from "@/components/cards/DocumentCard";
import { HistoryDrawer } from "@/components/history/HistoryDrawer";
import type { SessionType } from "@/lib/session-store";
import ReactMarkdown from "react-markdown";

// ---------- Card entry type ----------
interface CardEntry {
  id: string;
  type: "research" | "quick" | "document";
  query: string;
  file?: File; // for document cards
}

// ---------- Loaded session viewer ----------
function LoadedSession({
  title,
  content,
  type,
}: {
  title: string;
  content: string | null;
  type: SessionType;
}) {
  const t = useT();
  const typeLabel = type === "research" ? t("sessionResearch") : type === "document_qa" ? t("sessionDocQA") : t("sessionQuick");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 shadow-sm overflow-hidden"
    >
      <div className="bg-secondary/50 px-5 py-3">
        <p className="text-xs font-semibold text-muted-foreground">{typeLabel}</p>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="px-5 py-4">
        {content ? (
          <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground italic">No content saved.</p>
        )}
      </div>
    </motion.div>
  );
}

// ---------- Suggestion examples ----------
const EXAMPLES = [
  { icon: Lightbulb, text: "What are the latest breakthroughs in solid-state battery technology?" },
  { icon: FileSearch, text: "Compare RISC-V and ARM processors." },
  { icon: Brain, text: "What is the current state of quantum error correction?" },
  { icon: Layers, text: "How do large language model agents work?" },
];

// ---------- Main component ----------
export function UnifiedInterface() {
  const t = useT();
  const [cards, setCards] = React.useState<CardEntry[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [loadedSession, setLoadedSession] = React.useState<{
    title: string;
    content: string | null;
    type: SessionType;
  } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new cards are added.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, loadedSession]);

  function handleSend(text: string, files: AttachedFile[], mode: InputMode) {
    // Clear any loaded session.
    setLoadedSession(null);

    if (files.length > 0) {
      // Document Q&A — one card per file with the question.
      for (const f of files) {
        setCards((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "document" as const,
            query: text,
            file: f.file,
          },
        ]);
      }
    } else {
      const cardType = detectCardType(text, false, mode);
      setCards((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: cardType,
          query: text,
        },
      ]);
    }
  }

  function handleSelectSession(s: {
    id: string;
    type: SessionType;
    title: string;
    content: string | null;
  }) {
    setCards([]);
    setLoadedSession({ title: s.title, content: s.content, type: s.type });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-medium">{t("appName")}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label={t("historyPlaceholder")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content area */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        id="main-content"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4">
          {/* Empty state */}
          {cards.length === 0 && !loadedSession && (
            <div className="text-center max-w-2xl mx-auto pt-12 sm:pt-20 pb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{t("hello")}</h2>
              <p className="mt-3 text-muted-foreground text-sm sm:text-base">
                {t("quickSubtitle")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 text-left">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCards((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), type: "quick", query: ex.text },
                      ]);
                    }}
                    className="group flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3.5 transition-colors hover:bg-accent h-full"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ex.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[13px] leading-snug text-muted-foreground group-hover:text-foreground">
                      {ex.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loaded session from history */}
          {loadedSession && (
            <LoadedSession
              title={loadedSession.title}
              content={loadedSession.content}
              type={loadedSession.type}
            />
          )}

          {/* Cards */}
          <AnimatePresence mode="popLayout">
            {cards.map((card) => {
              if (card.type === "research") {
                return (
                  <ResearchCard
                    key={card.id}
                    query={card.query}
                    onStop={() => {
                      setCards((prev) => prev.filter((c) => c.id !== card.id));
                    }}
                  />
                );
              }
              if (card.type === "document" && card.file) {
                return (
                  <DocumentCard
                    key={card.id}
                    file={card.file}
                    initialQuestion={card.query}
                  />
                );
              }
              return <QuickCard key={card.id} question={card.query} />;
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Input bar (sticky bottom) */}
      <UnifiedInput onSend={handleSend} />

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 text-[11px] text-muted-foreground text-center">
          {t("appTagline")}
        </div>
      </footer>

      {/* History drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectSession}
      />
    </div>
  );
}
