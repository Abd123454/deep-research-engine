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
import { Sidebar } from "@/components/layout/Sidebar";
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
import { SwarmCard } from "@/components/cards/SwarmCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { detectArtifact as _detectArtifact, type Artifact } from "@/lib/artifact-detector";

// Lazy load heavy drawers — they're only needed when opened.
const HistoryDrawer = React.lazy(() =>
  import("@/components/history/HistoryDrawer").then((m) => ({ default: m.HistoryDrawer }))
);
import type { SessionType } from "@/lib/session-store";
import ReactMarkdown from "react-markdown";

// ---------- Card entry type ----------
interface CardEntry {
  id: string;
  type: "research" | "quick" | "document" | "chat" | "swarm";
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
export function UnifiedInterface({ onArtifact: _onArtifact }: { onArtifact?: (a: Artifact | null) => void }) {
  const t = useT();
  const [cards, setCards] = React.useState<CardEntry[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [_memoryOpen, setMemoryOpen] = React.useState(false);
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

  function handleNewChat() {
    setCards([]);
    setLoadedSession(null);
    setInputText("");
  }

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
    <div className="flex h-screen overflow-hidden bg-[#F0ECE0] dark:bg-[#2b2a27]">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectConversation={() => {}}
        conversations={[]}
        activeId={undefined}
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar — h-14, NO blur, transparent bg */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#E5E0D6] dark:border-[#3d3a35] px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex size-8 items-center justify-center rounded-md text-[#5b5950] hover:bg-[#1a1a18]/5 dark:text-[#a3a098] dark:hover:bg-[#eee]/5 transition-colors lg:hidden"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="font-serif text-base text-[#1a1a18] dark:text-[#eee]">New Conversation</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMemoryOpen(true)}
              aria-label="Memory"
              className="flex size-8 items-center justify-center rounded-md text-[#5b5950] hover:bg-[#1a1a18]/5 dark:text-[#a3a098] dark:hover:bg-[#eee]/5 transition-colors"
            >
              <BrainIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label="History"
              className="flex size-8 items-center justify-center rounded-md text-[#5b5950] hover:bg-[#1a1a18]/5 dark:text-[#a3a098] dark:hover:bg-[#eee]/5 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Content area — scrollable */}
        <main
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          id="main-content"
        >
          {/* Empty state — centered, max-w-2xl, Claude structure */}
          {cards.length === 0 && !loadedSession && (
            <div className="flex grow flex-col items-center justify-center px-4 min-h-[60vh]">
              <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch gap-5">
                {/* Hero — centered, serif, with Sparkle */}
                <h1 className="flex items-center justify-center gap-3 font-serif text-3xl text-[#1a1a18] dark:text-[#eee] sm:text-4xl">
                  <Sparkles className="fill-[#d97757] text-[#d97757] h-7 w-7" />
                  {t("hello")}
                </h1>

                {/* Composer */}
                <UnifiedInput
                  onSend={handleSend}
                  value={inputText}
                  onValueChange={setInputText}
                  textareaRef={textareaFocusRef}
                />

                {/* Mode tabs — card style with icon + text */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(ex.text)}
                      className="group flex items-start gap-3 rounded-2xl border border-[#E5E0D6] bg-white px-4 py-3 text-left hover:border-[#c96442]/30 hover:bg-[#F0ECE0]/50 transition-all dark:border-[#3d3a35] dark:bg-[#1f1e1b] dark:hover:bg-[#393937]/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0ECE0] text-[#c96442] dark:bg-[#393937]">
                        <ex.icon className="h-4 w-4" />
                      </div>
                      <span className="font-serif text-sm text-[#1a1a18] dark:text-[#eee] leading-snug">
                        {ex.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cards / messages */}
          {cards.length > 0 || loadedSession ? (
            <div className="mx-auto w-full max-w-2xl px-4 py-8 pb-40 space-y-4">
              {loadedSession && (
                <LoadedSession
                  title={loadedSession.title}
                  content={loadedSession.content}
                  type={loadedSession.type}
                />
              )}
              <AnimatePresence mode="popLayout">
                {cards.map((card) => {
                  if (card.type === "research") {
                    return (
                      <ErrorBoundary key={card.id}>
                        <ResearchCard
                          query={card.query}
                          onStop={() => {
                            setCards((prev) => prev.filter((c) => c.id !== card.id));
                          }}
                        />
                      </ErrorBoundary>
                    );
                  }
                  if (card.type === "document" && card.file) {
                    return (
                      <ErrorBoundary key={card.id}>
                        <DocumentCard
                          file={card.file}
                          initialQuestion={card.query}
                        />
                      </ErrorBoundary>
                    );
                  }
                  if (card.type === "chat") {
                    return (
                      <ErrorBoundary key={card.id}>
                        <ChatCard initialMessage={card.query} />
                      </ErrorBoundary>
                    );
                  }
                  if (card.type === "swarm") {
                    return (
                      <ErrorBoundary key={card.id}>
                        <SwarmCard task={card.query} />
                      </ErrorBoundary>
                    );
                  }
                  return (
                    <ErrorBoundary key={card.id}>
                      <QuickCard question={card.query} />
                    </ErrorBoundary>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : null}
        </main>

        {/* Input bar — only shown when there are cards (not in empty state) */}
        {cards.length > 0 && (
          <UnifiedInput
            onSend={handleSend}
            value={inputText}
            onValueChange={setInputText}
            textareaRef={textareaFocusRef}
          />
        )}
      </div>

      {/* History drawer */}
      <React.Suspense fallback={null}>
        <HistoryDrawer
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleSelectSession}
        />
      </React.Suspense>
    </div>
  );
}
