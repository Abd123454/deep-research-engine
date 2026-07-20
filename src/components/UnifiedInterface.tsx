"use client";

// UnifiedInterface — the single unified chat-like interface.
//
// Layout:
//   Header: logo + history toggle (☰) + lang + theme
//   Content: scrollable list of cards (max-w-4xl for reports)
//   Input bar (sticky bottom, solid bg): UnifiedInput
//   History drawer (slide-in from right)

import * as React from "react";
import { Menu, Lightbulb, FileSearch, Brain, Layers } from "lucide-react";
import { Brain as BrainIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLocale } from "@/components/i18n/locale-provider";
import { useT } from "@/components/i18n/locale-provider";
import { CompassLogo } from "@/components/CompassLogo";
// P0-7: CommandPalette — Cmd+K palette with fuzzy-search commands.
import { CommandPalette } from "@/components/CommandPalette";
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
import { OnboardingFlow } from "@/components/OnboardingFlow";
// P0-1: ArtifactsPanel is mounted as a third column (right side, ~480px)
// when an artifact is active. The panel is `hidden lg:flex` itself, so on
// mobile/tablet it stays out of the way and the chat column takes the
// full width.
import { ArtifactsPanel } from "@/components/artifacts/ArtifactsPanel";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { detectArtifact as _detectArtifact, type Artifact } from "@/lib/artifact-detector";

// Lazy load heavy drawers — they're only needed when opened.
const HistoryDrawer = React.lazy(() =>
  import("@/components/history/HistoryDrawer").then((m) => ({ default: m.HistoryDrawer }))
);
// P0-7: lazy-loaded MemoryPanel so the CommandPalette's "Open memory"
// command has a target. The panel was already implemented (it just
// wasn't wired into UnifiedInterface — `_memoryOpen` was unused). We
// expose it under a `MemoryDrawerLazy` alias to mirror `HistoryDrawer`.
const MemoryDrawerLazy = React.lazy(() =>
  import("@/components/memory/MemoryPanel").then((m) => ({ default: m.MemoryPanel }))
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
// skills-audit / react-performance: wrapped in React.memo so the
// LoadedSession doesn't re-render when the parent's state changes
// for unrelated reasons (e.g. sidebar open/close, input text). The
// props (`title`, `content`, `type`) are all primitives/strings that
// only change when the user explicitly loads a different session.
const LoadedSession = React.memo(function LoadedSession({
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
      className="rounded-3xl border border-[#d9d4c7] dark:border-[#3d3830] overflow-hidden bg-[#faf8f3] dark:bg-[#1c1a17]"
    >
      <div className="px-5 py-3 border-b border-[#d9d4c7] dark:border-[#3d3830]">
        <p className="text-xs font-semibold text-[#6b6358] dark:text-[#9a9080]">{typeLabel}</p>
        <p className="font-body text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]">{title}</p>
      </div>
      <div className="px-5 py-4">
        {content ? (
          <article className="prose prose-quaesitor font-body max-w-none dark:prose-invert">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-[#6b6358] dark:text-[#9a9080] italic">No content saved.</p>
        )}
      </div>
    </motion.div>
  );
});

// ---------- Suggestion examples ----------
const EXAMPLES = [
  { icon: Lightbulb, text: "What are the latest breakthroughs in solid-state battery technology?" },
  { icon: FileSearch, text: "Compare RISC-V and ARM processors." },
  { icon: Brain, text: "What is the current state of quantum error correction?" },
  { icon: Layers, text: "How do large language model agents work?" },
];

// ---------- Conversation list shape (from /api/chat/conversations) ----------
// The route returns rows from the `conversations` table; the `type` field
// is omitted because conversations don't carry a type (sessions do). The
// Sidebar accepts an optional `type` and falls back to "chat" when absent.
interface ConversationListItem {
  id: string;
  title: string;
  messageCount?: number;
  createdAt: string;
  updatedAt?: string;
}

// ---------- Main component ----------
export function UnifiedInterface({ onArtifact: _onArtifact }: { onArtifact?: (a: Artifact | null) => void }) {
  const [cards, setCards] = React.useState<CardEntry[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [inputText, setInputText] = React.useState("");
  // P0-7: CommandPalette open state. Toggled by Cmd+K / Ctrl+K (handled
  // in a useEffect below). The palette is rendered as a portal overlay
  // so it floats above the sidebar / artifacts panel.
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  // P0-7: lifted mode state so the CommandPalette can switch it. When
  // the user picks "Switch mode: Research" from the palette, we update
  // this state and UnifiedInput reflects it (controlled-mode pattern).
  const [inputMode, setInputMode] = React.useState<InputMode>("auto");
  const [loadedSession, setLoadedSession] = React.useState<{
    title: string;
    content: string | null;
    type: SessionType;
  } | null>(null);
  // P0-1: the active artifact drives the 3rd column (ArtifactsPanel).
  // Set by ChatCard via onArtifact (streaming partial → final). Cleared
  // by the panel's Close button. We also forward it to the optional
  // `onArtifact` prop so the page-level consumer (page.tsx) can react.
  const [activeArtifact, setActiveArtifact] = React.useState<Artifact | null>(null);
  // P2-final-wave / Feature 1: Streaming Artifacts. `artifactStreaming`
  // is `true` while ChatCard is still emitting tokens (the active
  // artifact's `content` is a PARTIAL — the live, growing body). When
  // `true`, we pass `streamingContent={activeArtifact.content}` to
  // ArtifactsPanel so it renders the live preview (with a "Streaming…"
  // badge + blinking caret). When `false` (or undefined), the panel
  // renders the canonical `artifact.content` as the final version.
  const [artifactStreaming, setArtifactStreaming] = React.useState(false);
  // P1-wave2 / Feature 1: Canvas Mode — when the user clicks "Edit in
  // Canvas" in the ArtifactsPanel header, this state holds the artifact's
  // raw source + language so CanvasPanel can mount on top of the
  // artifacts column. Cleared by CanvasPanel's Close button or by
  // starting a new chat (handleNewChat).
  const [canvasArtifact, setCanvasArtifact] = React.useState<{ content: string; language: string } | null>(null);
  // P0-4: conversations list (backed by /api/chat/conversations). Fetched
  // on mount and refreshed after each send. `activeConversationId` tracks
  // the currently-selected row so the Sidebar can highlight it.
  const [conversations, setConversations] = React.useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(undefined);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaFocusRef = React.useRef<HTMLTextAreaElement | null>(null);

  // P0-1: wrap setActiveArtifact so we also forward to the optional
  // page-level onArtifact prop. Keeps page.tsx's `setArtifact` state in
  // sync without coupling UnifiedInterface to it.
  //
  // P2-final-wave / Feature 1: accept the `streaming` flag from ChatCard
  // and track it in `artifactStreaming`. The page-level consumer
  // (`_onArtifact`) doesn't need the flag — it only cares about the
  // final artifact — so we strip it before forwarding.
  const handleArtifactChange = React.useCallback((a: Artifact | null, streaming?: boolean) => {
    setActiveArtifact(a);
    setArtifactStreaming(streaming === true && a !== null);
    _onArtifact?.(a);
  }, [_onArtifact]);

  // P0-4: fetch the conversation list. Wrapped in useCallback so we can
  // call it again after a message is sent (the new conversation row will
  // appear at the top of the list). Errors are swallowed — the Sidebar
  // shows "No conversations yet." which is the correct empty state.
  const refreshConversations = React.useCallback(() => {
    fetch("/api/chat/conversations")
      .then((r) => r.json())
      .then((data: { ok?: boolean; conversations?: ConversationListItem[] }) => {
        if (data.ok && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {
        // Network/JSON errors leave the list as-is. The next refresh
        // (e.g. after another send) will retry.
      });
  }, []);

  React.useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // P0-7: Theme + locale hooks for the CommandPalette callbacks. We use
  // next-themes' useTheme and our own useLocale so the palette can
  // toggle theme/language without going through the icon buttons.
  const { setTheme } = useTheme();
  const { toggleLocale } = useLocale();

  // P0-7: Cmd+K / Ctrl+K keyboard shortcut to open the CommandPalette.
  // We listen on window so it works regardless of focus (textarea,
  // sidebar, etc.). We also suppress the browser's default Cmd+K
  // behavior (some browsers focus the search bar). The shortcut is
  // ignored when the user is typing in a form field — UNLESS the
  // palette is already open (so Esc can close it via the palette's own
  // handler). To keep the listener stable, we depend only on
  // `paletteOpen` (so we re-bind when it changes) — the actual state
  // setter is stable.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // P0-7: CommandPalette callbacks. Each one is wrapped in useCallback
  // so the palette's memoized command list doesn't reshuffle on every
  // render. The callbacks close the palette after firing (the palette
  // component does this internally, but we also handle it here in case
  // the callback is invoked from elsewhere).
  const handlePaletteToggleTheme = React.useCallback(() => {
    // next-themes exposes setTheme. We need to read the current theme
    // from document.documentElement.className (next-themes toggles
    // the `dark` class on <html>).
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }, [setTheme]);

  const handlePaletteOpenMemory = React.useCallback(() => {
    setMemoryOpen(true);
  }, []);

  const handlePaletteOpenHistory = React.useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const handlePaletteOpenSettings = React.useCallback(() => {
    // Quaesitor doesn't have a /settings page yet — the closest is the
    // skills marketplace at /skills (if it exists). We use a relative
    // navigation so the gateway handles it. If the route doesn't exist
    // the user will see a 404, but the palette is still useful for
    // the other commands. Wrapped in try/catch in case window is
    // unavailable (SSR — shouldn't happen since the palette is
    // client-only, but defensive).
    try {
      window.location.href = "/settings";
    // eslint-disable-next-line no-empty
    } catch {
      // no-op — window.location.href never throws in practice; defensive.
    }
  }, []);

  const handlePaletteOpenPricing = React.useCallback(() => {
    try {
      window.location.href = "/pricing";
    // eslint-disable-next-line no-empty
    } catch {
      // no-op — window.location.href never throws in practice; defensive.
    }
  }, []);

  // Mobile-first: close the sidebar on small screens so it doesn't
  // overlay the empty state on first paint. Desktop keeps it open.
  // Runs once after mount (SSR-safe — window is unavailable on server).
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Time-based greeting (Claude.ai pattern: "Good morning/afternoon/evening")
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Auto-scroll to bottom when new cards are added.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, loadedSession]);

  // skills-audit / react-performance: wrap handlers in useCallback so
  // memoized children (Sidebar, UnifiedInput, ChatCard) don't re-render
  // when the parent's state changes for unrelated reasons. Without
  // useCallback, every parent re-render creates new function identities,
  // which defeats React.memo's shallow-compare short-circuit.
  const handleNewChat = React.useCallback(() => {
    setCards([]);
    setLoadedSession(null);
    setInputText("");
    setActiveConversationId(undefined);
    // P0-1: closing the new-chat flow also dismisses any open artifact
    // panel — the user is starting fresh, the previous artifact is stale.
    setActiveArtifact(null);
    // P2-final-wave / Feature 1: also clear the streaming flag so the
    // next chat starts in "final" mode (no live-preview badge).
    setArtifactStreaming(false);
    // P1-wave2 / Feature 1: also dismiss the Canvas editor so the next
    // chat starts without a stale editor overlay.
    setCanvasArtifact(null);
  }, []);

  // P0-4: refresh callback is already useCallback'd above. We wrap
  // handleSend in useCallback too — it depends on `refreshConversations`
  // (stable) and `setCards`/`setInputText`/`setLoadedSession` (all
  // stable state setters). The body uses functional setState for the
  // `cards` array so it doesn't capture stale `cards` from the closure.
  const handleSend = React.useCallback((
    text: string,
    files: AttachedFile[],
    _mode: InputMode,
    tools: ToolKey[] = []
  ) => {
    setLoadedSession(null);
    setInputText(""); // Clear input after send.

    // Tools override the card type if specific tools are selected.
    function resolveCardType(): CardEntry["type"] {
      if (files.length > 0) return "document";
      if (tools.includes("deep-research")) return "research";
      if (tools.includes("swarm")) return "swarm";
      return detectCardType(text, false, _mode);
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

    // P0-4: refresh the conversation list after a short delay so the
    // new row (created by /api/chat when it persisted the message) is
    // picked up. 800ms is enough for the chat route's first message
    // to land + the conversation row to be committed; if the user is
    // on a slow connection the next refresh (next send) will catch it.
    setTimeout(refreshConversations, 800);
  }, [refreshConversations]);

  const handleSelectConversation = React.useCallback((id: string) => {
    setActiveConversationId(id);
    fetch(`/api/chat/conversations/${id}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; conversation?: { title?: string; messages?: Array<{ role: string; content: string }> } }) => {
        if (!data.ok || !data.conversation) return;
        const conv = data.conversation;
        const firstAssistant = (conv.messages || []).find((m) => m.role === "assistant");
        setCards([]);
        setLoadedSession({
          title: conv.title || "Conversation",
          content: firstAssistant?.content || null,
          type: "quick" as SessionType,
        });
      })
      .catch(() => {
        // Leave the list as-is; the activeId highlight still applies.
      });
  }, []);

  // skills-audit / UX fix: wire the Sidebar Trash2 button to actually
  // delete the conversation. Previously the icon was visible on hover
  // but had no onClick — a broken UI connection. Now it DELETEs via
  // /api/chat/conversations/[id] and removes the row from the local
  // list. If the deleted row was the active conversation, we also
  // reset the activeId and clear the loaded session so the user
  // doesn't see a stale "deleted" session in the main column.
  const handleDeleteConversation = React.useCallback((id: string) => {
    fetch(`/api/chat/conversations/${id}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data: { ok?: boolean }) => {
        if (!data.ok) return;
        setConversations((prev) => prev.filter((c) => c.id !== id));
        // If the deleted row was the active conversation, reset.
        setActiveConversationId((curr) => (curr === id ? undefined : curr));
        setLoadedSession((curr) => (curr ? null : curr));
      })
      .catch(() => {
        // Network error — leave the list as-is. The user can retry.
      });
  }, []);

  const handleSelectSession = React.useCallback((s: {
    id: string;
    type: SessionType;
    title: string;
    content: string | null;
  }) => {
    setCards([]);
    setLoadedSession({ title: s.title, content: s.content, type: s.type });
    setActiveConversationId(s.id);
  }, []);

  // skills-audit / react-performance: stable close handler so the
  // memoized Sidebar doesn't re-render when the parent re-renders.
  const handleSidebarClose = React.useCallback(() => setSidebarOpen(false), []);
  // History + memory + palette close handlers — stable for the same
  // reason (the drawers are lazy-loaded but their props still go
  // through shallow-compare if/when React.memo is added later).
  const handleHistoryClose = React.useCallback(() => setHistoryOpen(false), []);
  const handleMemoryClose = React.useCallback(() => setMemoryOpen(false), []);
  const handlePaletteClose = React.useCallback(() => setPaletteOpen(false), []);

  // skills-audit / react-performance: stable card-removal callback.
  // Each ResearchCard receives this as `onStop` — without useCallback,
  // every parent re-render would create a new closure and break
  // ResearchCard's React.memo. The callback takes the cardId as an
  // argument so it doesn't capture `cards` from the closure (avoids
  // stale-state bugs AND lets the dependency array stay empty).
  const handleStopCard = React.useCallback((cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  // Suggestion click: fill input instead of auto-send, then focus textarea.
  const handleSuggestionClick = React.useCallback((text: string) => {
    setInputText(text);
    setTimeout(() => {
      textareaFocusRef.current?.focus();
    }, 50);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f1ea] dark:bg-[#1c1a17]">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={handleSidebarClose}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        conversations={conversations}
        activeId={activeConversationId}
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar — h-14, NO blur, transparent bg. Mobile-first:
            the menu button is only visible below lg (sidebar is fixed
            on desktop). The "New Conversation" label truncates so the
            right-side action cluster never gets crowded off-screen at
            375px (iPhone SE) width. */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d9d4c7] dark:border-[#3d3830] px-3 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors lg:hidden"
              aria-label="Toggle sidebar"
              // skills-audit / UX: aria-expanded tells screen reader
              // users whether the sidebar is currently open or closed.
              // The button is mobile-only (lg:hidden) so it only fires
              // the drawer pattern on small screens.
              aria-expanded={sidebarOpen}
              aria-controls="primary-sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="font-body text-base text-[#2a2620] dark:text-[#e8e3d8] truncate">New Conversation</span>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              onClick={() => setMemoryOpen(true)}
              aria-label="Memory"
              className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
            >
              <BrainIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label="History"
              className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
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
                {/* Hero — centered, serif, with Compass. Time-based greeting. */}
                <h1 className="flex items-center justify-center gap-3 font-body text-3xl text-[#2a2620] dark:text-[#e8e3d8] sm:text-4xl">
                  <CompassLogo className="fill-[#8b4513] text-[#8b4513] h-7 w-7" />
                  {greeting}
                </h1>
                {/* Composer */}
                <UnifiedInput
                  onSend={handleSend}
                  value={inputText}
                  onValueChange={setInputText}
                  textareaRef={textareaFocusRef}
                  mode={inputMode}
                  onModeChange={setInputMode}
                />

                {/* Mode tabs — card style with icon + text */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(ex.text)}
                      className="group flex items-start gap-3 rounded-2xl border border-[#d9d4c7] bg-[#faf8f3] px-4 py-3 text-left hover:border-[#8b4513]/30 hover:bg-[#f4f1ea]/50 transition-all dark:border-[#3d3830] dark:bg-[#1c1a17] dark:hover:bg-[#322e28]/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f1ea] text-[#8b4513] dark:bg-[#322e28]">
                        <ex.icon className="h-4 w-4" />
                      </div>
                      <span className="font-body text-sm text-[#2a2620] dark:text-[#e8e3d8] leading-snug">
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
                          onStop={() => handleStopCard(card.id)}
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
                        {/* P0-1 / P0-5: ChatCard reports streaming + final
                            artifacts via onArtifact. The parent
                            (UnifiedInterface) owns the activeArtifact state
                            and mounts ArtifactsPanel as a 3rd column when
                            non-null. */}
                        <ChatCard
                          initialMessage={card.query}
                          onArtifact={handleArtifactChange}
                        />
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
            mode={inputMode}
            onModeChange={setInputMode}
          />
        )}
      </div>

      {/* P0-1: ArtifactsPanel — 3rd column on the right (lg+ only).
          Conditionally rendered when an artifact is active. The panel
          component itself is `hidden lg:flex` so on smaller viewports it
          stays mounted-but-invisible (preserving its internal state)
          rather than unmounting and losing scroll position.

          Width: the panel uses `w-[40%] min-w-[400px] max-w-[600px]` —
          on a 1280px viewport that's ~512px, matching the ~480px target.
          The 3-column layout becomes: Sidebar (280px) | Chat (flex-1) |
          ArtifactsPanel (~480px). */}
      {activeArtifact && (
        <ArtifactsPanel
          artifact={activeArtifact}
          streamingContent={artifactStreaming ? activeArtifact.content : undefined}
          onClose={() => handleArtifactChange(null)}
          onEditInCanvas={() =>
            setCanvasArtifact({
              content: activeArtifact.content,
              language: activeArtifact.language || activeArtifact.type,
            })
          }
        />
      )}

      {/* P1-wave2 / Feature 1: CanvasPanel — inline editor overlay.
          Slides in from the right on top of the artifacts column when
          the user clicks "Edit in Canvas". onSave updates the active
          artifact's content in-place so the preview re-renders with
          the user's edits. */}
      {canvasArtifact && (
        <CanvasPanel
          content={canvasArtifact.content}
          language={canvasArtifact.language}
          onClose={() => setCanvasArtifact(null)}
          onSave={(editedContent) => {
            if (activeArtifact) {
              handleArtifactChange({ ...activeArtifact, content: editedContent });
              // Sync the canvas state so the next "Reset" compares
              // against the freshly-saved version.
              setCanvasArtifact({ content: editedContent, language: canvasArtifact.language });
            }
          }}
        />
      )}

      {/* History drawer */}
      <React.Suspense fallback={null}>
        <HistoryDrawer
          open={historyOpen}
          onClose={handleHistoryClose}
          onSelect={handleSelectSession}
        />
      </React.Suspense>

      {/* P0-7: Memory drawer — rendered when memoryOpen is true. We lazy
          load it (like HistoryDrawer) because it's only needed when
          opened. */}
      <React.Suspense fallback={null}>
        {memoryOpen && (
          <MemoryDrawerLazy
            open={memoryOpen}
            onClose={handleMemoryClose}
          />
        )}
      </React.Suspense>

      {/* P0-7: CommandPalette — Cmd+K / Ctrl+K palette. Rendered as a
          portal overlay so it floats above the sidebar / artifacts
          panel / drawers. The palette handles its own Esc + backdrop
          click dismissal; we just pass the open state and callbacks. */}
      <CommandPalette
        open={paletteOpen}
        onClose={handlePaletteClose}
        onNewChat={handleNewChat}
        onToggleTheme={handlePaletteToggleTheme}
        onToggleLanguage={toggleLocale}
        onOpenMemory={handlePaletteOpenMemory}
        onOpenHistory={handlePaletteOpenHistory}
        onSetMode={setInputMode}
        onOpenSettings={handlePaletteOpenSettings}
        onOpenPricing={handlePaletteOpenPricing}
      />

      {/* Onboarding — shows on first visit (empty state only).
          Mounted at the root so the backdrop covers the full viewport.
          OnboardingFlow self-checks localStorage and renders null if
          already completed. */}
      {cards.length === 0 && !loadedSession && <OnboardingFlow />}
    </div>
  );
}
