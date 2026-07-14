"use client";

// UnifiedInterface — the single unified chat-like interface.
//
// Layout:
//   Header: logo + history toggle (☰) + lang + theme
//   Content: scrollable list of cards (max-w-4xl for reports)
//   Input bar (sticky bottom, backdrop-blur): UnifiedInput
//   History drawer (slide-in from right)

import * as React from "react";
import { Sparkles, Menu, Lightbulb, FileSearch, Brain, Layers } from "lucide-react";
import { Brain as BrainIcon } from "lucide-react";
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
import { ChatCard } from "@/components/cards/ChatCard";
import { HistoryDrawer } from "@/components/history/HistoryDrawer";
import { MemoryPanel } from "@/components/memory/MemoryPanel";
import type { SessionType } from "@/lib/session-store";
import ReactMarkdown from "react-markdown";

// ---------- Card entry type ----------
interface CardEntry {
  id: string;
  type: "research" | "quick" | "document" | "chat";
  query: string;
  file?: File;
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
      className="rounded-3xl border border-border/60 shadow-md overflow-hidden"
    >
      <div className="bg-gradient-to-r from-secondary to-background px-5 py-3 border-b border-border/40">
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
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [inputText, setInputText] = React.useState("");
  const [loadedSession, setLoadedSession] = React.useState<{
    title: string;
    content: string | null;
    type: SessionType;
  } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaFocusRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom when new cards are added.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, loadedSession]);

  function handleSend(text: string, files: AttachedFile[], mode: InputMode) {
    setLoadedSession(null);
    setInputText(""); // Clear input after send.

    if (files.length > 0) {
      for (const f of files) {
        setCards((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: "document" as const, query: text, file: f.file },
        ]);
      }
    } else {
      const cardType = detectCardType(text, false, mode);
      setCards((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: cardType, query: text },
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

  // Suggestion click: fill input instead of auto-send, then focus textarea.
  function handleSuggestionClick(text: string) {
    setInputText(text);
    setTimeout(() => {
      textareaFocusRef.current?.focus();
    }, 50);
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-semibold">{t("appName")}</h1>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ml-1" title="Online" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMemoryOpen(true)}
              aria-label="Memory"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <BrainIcon className="h-4 w-4" />
            </button>
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

      {/* Content area — scrollable, with bottom padding for input bar */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        id="main-content"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 pb-40 space-y-4">
          {/* Empty state */}
          {cards.length === 0 && !loadedSession && (
            <div className="text-center max-w-2xl mx-auto pt-16 sm:pt-24 pb-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-gradient shadow-lg mb-6">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {t("hello")}
                </span>
              </h2>
              <p className="mt-3 text-muted-foreground text-base sm:text-lg">
                {t("quickSubtitle")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 text-left">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(ex.text)}
                    className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ex.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm leading-snug text-muted-foreground group-hover:text-foreground">
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
              if (card.type === "chat") {
                return <ChatCard key={card.id} initialMessage={card.query} />;
              }
              return <QuickCard key={card.id} question={card.query} />;
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Input bar — sticky bottom with backdrop blur */}
      <UnifiedInput
        onSend={handleSend}
        value={inputText}
        onValueChange={setInputText}
        textareaRef={textareaFocusRef}
      />

      {/* History drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectSession}
      />

      {/* Memory panel */}
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
    </div>
  );
}
