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
  type ToolKey,
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
      className="rounded-3xl border border-[#e8e6dc] dark:border-[#3d3a35] overflow-hidden bg-[#faf9f5] dark:bg-[#1a1a18]"
    >
      <div className="px-5 py-3 border-b border-[#e8e6dc] dark:border-[#3d3a35]">
        <p className="text-xs font-semibold text-[#87867f] dark:text-[#a3a098]">{typeLabel}</p>
        <p className="font-serif text-sm font-medium text-[#141413] dark:text-[#faf9f5]">{title}</p>
      </div>
      <div className="px-5 py-4">
        {content ? (
          <article className="prose prose-claude font-serif max-w-none dark:prose-invert">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-[#87867f] dark:text-[#a3a098] italic">No content saved.</p>
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

  function handleSend(text: string, files: AttachedFile[], mode: InputMode, tools: ToolKey[] = []) {
    setLoadedSession(null);
    setInputText(""); // Clear input after send.

    // Tools override the card type if specific tools are selected.
    function resolveCardType(): CardEntry["type"] {
      if (files.length > 0) return "document";
      // Tool-based routing: deep-research → research, swarm → swarm, image-gen → chat (handled in card)
      if (tools.includes("deep-research")) return "research";
      if (tools.includes("swarm")) return "swarm";
      return detectCardType(text, false, mode);
    }

    if (files.length > 0) {
      for (const f of files) {
        setCards((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: "document" as const, query: text, file: f.file },
        ]);
      }
    } else {
      const cardType = resolveCardType();
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
    <div className="flex h-screen overflow-hidden bg-[#f0eee6] dark:bg-[#1a1a18]">
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e8e6dc] dark:border-[#3d3a35] px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex size-8 items-center justify-center rounded-md text-[#5e5d59] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors lg:hidden"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="font-serif text-base text-[#141413] dark:text-[#faf9f5]">New Conversation</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMemoryOpen(true)}
              aria-label="Memory"
              className="flex size-8 items-center justify-center rounded-md text-[#5e5d59] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors"
            >
              <BrainIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label="History"
              className="flex size-8 items-center justify-center rounded-md text-[#5e5d59] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors"
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
                <h1 className="flex items-center justify-center gap-3 font-serif text-3xl text-[#141413] dark:text-[#faf9f5] sm:text-4xl">
                  <Sparkles className="fill-[#c96442] text-[#c96442] h-7 w-7" />
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
                      className="group flex items-start gap-3 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-3 text-left hover:border-[#c96442]/30 hover:bg-[#f0eee6]/50 transition-all dark:border-[#3d3a35] dark:bg-[#1a1a18] dark:hover:bg-[#393937]/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0eee6] text-[#c96442] dark:bg-[#393937]">
                        <ex.icon className="h-4 w-4" />
                      </div>
                      <span className="font-serif text-sm text-[#141413] dark:text-[#faf9f5] leading-snug">
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
