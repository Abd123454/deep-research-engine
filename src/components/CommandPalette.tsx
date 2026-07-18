"use client";

// CommandPalette — Cmd+K / Ctrl+K palette (P0-7).
//
// A keyboard-accessible command palette that opens with Cmd+K (Mac) or
// Ctrl+K (Windows/Linux) and lets the user jump to any common action:
// new chat, toggle theme, toggle language, open memory/history, switch
// mode (Auto/Research/Quick/Chat/Swarm), install skill, view pricing.
//
// Design: Quaesitor "Investigator's Journal" palette — warm cream cards
// (#faf8f3 light / #1c1a17 dark), saddle-brown accents (#8b4513 light /
// #b5673a dark), deckle-edge borders (#d9d4c7 light / #3d3830 dark).
// Font-ui (DM Sans) for the palette chrome; the search input is also
// font-ui for a "tool" feel, while result rows use font-body (Newsreader)
// to match the reading-first philosophy.
//
// Accessibility:
//   - role="dialog" + aria-modal on the backdrop
//   - role="listbox" on the results, role="option" on each row
//   - aria-activedescendant tracks the active row for screen readers
//   - Arrow Up/Down moves the active row, Enter selects, Esc closes
//   - The search input is auto-focused on open
//   - Backdrop click closes (pointer-only — keyboard users use Esc)
//   - 5–7 results shown at once; category labels group them
//
// The palette is rendered as a modal overlay centered in the viewport
// with a backdrop. It's portalled to document.body via createPortal so
// it floats above any layout context (sidebar, artifacts panel, etc.).

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MessageSquarePlus,
  Sun,
  Languages,
  Brain,
  History,
  Microscope,
  Zap,
  MessageCircle,
  Users,
  Sparkles,
  DollarSign,
  CornerDownLeft,
} from "lucide-react";
import type { InputMode } from "@/components/input/UnifiedInput";

// ---------- Command model ----------

export type CommandCategory = "Actions" | "Mode" | "Navigate";

export interface Command {
  id: string;
  /** User-visible label, e.g. "New chat". */
  label: string;
  /** Optional secondary text shown muted under the label. */
  hint?: string;
  /** Keywords used for fuzzy matching (in addition to the label). */
  keywords?: string[];
  /** Lucide icon component. */
  icon: React.ComponentType<{ className?: string }>;
  /** Group label rendered as a section heading. */
  category: CommandCategory;
  /** Invoking the command calls this callback. */
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onOpenMemory: () => void;
  onOpenHistory: () => void;
  /** Sets the input mode (Auto/Research/Quick/Chat/Swarm). */
  onSetMode: (mode: InputMode) => void;
  /** Navigate to /settings (skill installation). */
  onOpenSettings?: () => void;
  /** Navigate to /pricing. */
  onOpenPricing?: () => void;
}

// ---------- Fuzzy match ----------
//
// A lightweight subsequence-with-scoring matcher (not a full fuzzy
// library). Returns a score >= 0 if `query` matches `target` as a
// subsequence (case-insensitive), with bonuses for:
//   - consecutive chars (run length)
//   - word-start matches (camelCase / kebab-case boundaries)
// Returns 0 for no match.
//
// We match against the label AND any keywords, keeping the best score.

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) {
    // Substring match — strong signal.
    // Bonus for matches at word boundaries or at the start.
    const idx = t.indexOf(q);
    const atStart = idx === 0;
    const prevChar = idx > 0 ? t[idx - 1] : "";
    const atBoundary = idx === 0 || prevChar === " " || prevChar === "-" || prevChar === "_";
    return 100 + (atStart ? 30 : atBoundary ? 20 : 10) - idx;
  }
  // Subsequence match with consecutive-char bonus.
  let qi = 0;
  let score = 0;
  let run = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + run * 2; // consecutive matches ramp up
      run += 1;
      qi += 1;
      // Word-boundary bonus.
      const prev = ti > 0 ? t[ti - 1] : "";
      if (prev === " " || prev === "-" || prev === "_") score += 5;
    } else {
      run = 0;
    }
  }
  return qi === q.length ? score : 0;
}

function matchCommand(query: string, cmd: Command): number {
  const labelScore = fuzzyScore(query, cmd.label);
  const kwScore = cmd.keywords
    ? Math.max(...cmd.keywords.map((k) => fuzzyScore(query, k)))
    : 0;
  return Math.max(labelScore, kwScore);
}

// ---------- Palette ----------

export function CommandPalette({
  open,
  onClose,
  onNewChat,
  onToggleTheme,
  onToggleLanguage,
  onOpenMemory,
  onOpenHistory,
  onSetMode,
  onOpenSettings,
  onOpenPricing,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  // Portal target — render to document.body so the palette floats above
  // any layout context (sidebar, artifacts panel). SSR-safe: until
  // mounted, we render nothing (the palette is closed during SSR anyway).
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      setPortalTarget(document.body);
    }
  }, []);

  // Build the command list. Memoized so the order doesn't reshuffle on
  // every keystroke — the callbacks are stable (useCallback in the
  // parent), but the array identity changes each render without this.
  const commands: Command[] = React.useMemo(() => {
    const list: Command[] = [
      {
        id: "new-chat",
        label: "New chat",
        hint: "Clear the conversation and start fresh",
        keywords: ["clear", "reset", "new conversation"],
        icon: MessageSquarePlus,
        category: "Actions",
        run: () => {
          onNewChat();
          onClose();
        },
      },
      {
        id: "toggle-theme",
        label: "Toggle theme",
        hint: "Switch between light and dark",
        keywords: ["dark", "light", "appearance", "mode"],
        icon: Sun,
        category: "Actions",
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: "toggle-language",
        label: "Toggle language",
        hint: "Switch between English and العربية",
        keywords: ["english", "arabic", "locale", "i18n"],
        icon: Languages,
        category: "Actions",
        run: () => {
          onToggleLanguage();
          onClose();
        },
      },
      {
        id: "open-memory",
        label: "Open memory",
        hint: "View stored memories about you",
        keywords: ["remember", "facts", "preferences"],
        icon: Brain,
        category: "Actions",
        run: () => {
          onOpenMemory();
          onClose();
        },
      },
      {
        id: "open-history",
        label: "Open history",
        hint: "Browse past research sessions",
        keywords: ["sessions", "past", "recent"],
        icon: History,
        category: "Actions",
        run: () => {
          onOpenHistory();
          onClose();
        },
      },
      // Mode group — one command per mode so the user can pick by name.
      {
        id: "mode-auto",
        label: "Switch mode: Auto",
        hint: "Detect the best mode automatically",
        keywords: ["automatic", "detect"],
        icon: Sparkles,
        category: "Mode",
        run: () => {
          onSetMode("auto");
          onClose();
        },
      },
      {
        id: "mode-research",
        label: "Switch mode: Research",
        hint: "Deep multi-step research with citations",
        keywords: ["deep", "investigate", "report"],
        icon: Microscope,
        category: "Mode",
        run: () => {
          onSetMode("research");
          onClose();
        },
      },
      {
        id: "mode-quick",
        label: "Switch mode: Quick",
        hint: "Fast single-shot answer",
        keywords: ["fast", "quick", "instant"],
        icon: Zap,
        category: "Mode",
        run: () => {
          onSetMode("quick");
          onClose();
        },
      },
      {
        id: "mode-chat",
        label: "Switch mode: Chat",
        hint: "Multi-turn conversational chat",
        keywords: ["conversation", "talk", "dialog"],
        icon: MessageCircle,
        category: "Mode",
        run: () => {
          onSetMode("chat");
          onClose();
        },
      },
      {
        id: "mode-swarm",
        label: "Switch mode: Swarm",
        hint: "Multi-agent collaborative task",
        keywords: ["agents", "multi", "collaborative"],
        icon: Users,
        category: "Mode",
        run: () => {
          onSetMode("swarm");
          onClose();
        },
      },
    ];

    // Navigate group — only include if a callback was provided.
    if (onOpenSettings) {
      list.push({
        id: "open-settings",
        label: "Install skill",
        hint: "Open settings to browse & install skills",
        keywords: ["settings", "skills", "mcp", "extensions", "plugins"],
        icon: Sparkles,
        category: "Navigate",
        run: () => {
          onOpenSettings();
          onClose();
        },
      });
    }
    if (onOpenPricing) {
      list.push({
        id: "open-pricing",
        label: "View pricing",
        hint: "See plans and upgrade options",
        keywords: ["plans", "upgrade", "billing", "subscription"],
        icon: DollarSign,
        category: "Navigate",
        run: () => {
          onOpenPricing();
          onClose();
        },
      });
    }
    return list;
  }, [
    onNewChat,
    onToggleTheme,
    onToggleLanguage,
    onOpenMemory,
    onOpenHistory,
    onSetMode,
    onOpenSettings,
    onOpenPricing,
    onClose,
  ]);

  // Filter + rank. Empty query shows ALL commands (grouped by category).
  const filtered = React.useMemo(() => {
    if (!query.trim()) return commands;
    const scored = commands
      .map((cmd) => ({ cmd, score: matchCommand(query.trim(), cmd) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.cmd);
  }, [query, commands]);

  // Group filtered commands by category, preserving the score-based order
  // within each category. The first category encountered in `filtered`
  // comes first. Cap total visible at 7 to keep the palette compact.
  const MAX_VISIBLE = 7;
  const grouped = React.useMemo(() => {
    const groups: { category: CommandCategory; items: Command[] }[] = [];
    const seenCategories = new Set<CommandCategory>();
    for (const cmd of filtered) {
      if (!seenCategories.has(cmd.category)) {
        seenCategories.add(cmd.category);
        groups.push({ category: cmd.category, items: [] });
      }
      groups[groups.length - 1]!.items.push(cmd);
    }
    // Apply the global cap by trimming each group's tail.
    let remaining = MAX_VISIBLE;
    for (const g of groups) {
      if (remaining <= 0) {
        g.items = [];
        continue;
      }
      if (g.items.length > remaining) {
        g.items = g.items.slice(0, remaining);
      }
      remaining -= g.items.length;
    }
    // Drop empty groups (capped to zero).
    return groups.filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat list of visible commands — used for keyboard navigation.
  const flatVisible = React.useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped]
  );

  // Reset query + active index when the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Auto-focus the input on the next tick (after the portal mounts).
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Clamp activeIndex when the filtered list shrinks.
  React.useEffect(() => {
    if (activeIndex >= flatVisible.length) {
      setActiveIndex(Math.max(0, flatVisible.length - 1));
    }
  }, [flatVisible.length, activeIndex]);

  // Scroll the active row into view. Without this, arrow-down past the
  // bottom of the visible list leaves the active row hidden below the fold.
  React.useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  // Keyboard handler — bound to the input so it doesn't conflict with
  // global Cmd+K handling in the parent. We stopPropagation on the
  // navigation keys so they don't bubble to the textarea.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.min(i + 1, flatVisible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const cmd = flatVisible[activeIndex];
      if (cmd) cmd.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh] sm:pt-[15vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          // Backdrop click closes. Clicks inside the panel are stopped
          // by the panel's onClick handler so they don't bubble up.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop — solid bg-[#2a2620]/30 matches Quaesitor's "no
              backdrop-blur" anti-pattern (DESIGN.md). */}
          <div className="absolute inset-0 bg-[#2a2620]/30 dark:bg-black/50" aria-hidden="true" />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#d9d4c7] bg-[#faf8f3] dark:border-[#3d3830] dark:bg-[#252220]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input — font-ui (DM Sans) for a "tool" feel. */}
            <div className="flex items-center gap-2.5 border-b border-[#d9d4c7] px-4 py-3 dark:border-[#3d3830]">
              <Search className="h-4 w-4 shrink-0 text-[#6b6358] dark:text-[#9a9080]" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Type a command or search…"
                className="flex-1 border-0 bg-transparent font-ui text-[15px] text-[#2a2620] placeholder:text-[#6b6358] focus:outline-none dark:text-[#e8e3d8] dark:placeholder:text-[#9a9080]"
                aria-label="Search commands"
                aria-controls="command-list"
                aria-activedescendant={flatVisible[activeIndex]?.id ?? undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden shrink-0 rounded border border-[#d9d4c7] bg-[#f4f1ea] px-1.5 py-0.5 font-mono text-[10px] text-[#6b6358] dark:border-[#3d3830] dark:bg-[#1c1a17] dark:text-[#9a9080] sm:inline">
                Esc
              </kbd>
            </div>

            {/* Results — listbox role for screen readers. */}
            <div
              ref={listRef}
              id="command-list"
              role="listbox"
              aria-label="Available commands"
              className="max-h-[60vh] overflow-y-auto p-2"
            >
              {flatVisible.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080]">
                    No commands match{" "}
                    <span className="font-medium text-[#2a2620] dark:text-[#e8e3d8]">“{query}”</span>.
                  </p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.category} className="mb-1 last:mb-0">
                    {/* Category label — small caps, muted. */}
                    <div className="px-3 pt-2 pb-1 font-ui text-[10px] font-semibold uppercase tracking-wider text-[#6b6358] dark:text-[#9a9080]">
                      {group.category}
                    </div>
                    {group.items.map((cmd) => {
                      const flatIdx = flatVisible.indexOf(cmd);
                      const isActive = flatIdx === activeIndex;
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          id={cmd.id}
                          data-index={flatIdx}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => cmd.run()}
                          className={
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors " +
                            (isActive
                              ? "bg-[#8b4513]/10 dark:bg-[#b5673a]/15"
                              : "hover:bg-[#2a2620]/5 dark:hover:bg-[#e8e3d8]/5")
                          }
                        >
                          <Icon
                            className={
                              "h-4 w-4 shrink-0 " +
                              (isActive
                                ? "text-[#8b4513] dark:text-[#b5673a]"
                                : "text-[#6b6358] dark:text-[#9a9080]")
                            }
                            aria-hidden="true"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-body text-[14px] text-[#2a2620] dark:text-[#e8e3d8]">
                              {cmd.label}
                            </span>
                            {cmd.hint && (
                              <span className="block truncate font-ui text-[11px] text-[#6b6358] dark:text-[#9a9080]">
                                {cmd.hint}
                              </span>
                            )}
                          </span>
                          {isActive && (
                            <CornerDownLeft
                              className="h-3.5 w-3.5 shrink-0 text-[#8b4513] dark:text-[#b5673a]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer — keyboard hints. font-ui for chrome text. */}
            <div className="flex items-center justify-between border-t border-[#d9d4c7] px-4 py-2 dark:border-[#3d3830]">
              <div className="flex items-center gap-3 font-ui text-[10px] text-[#6b6358] dark:text-[#9a9080]">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-[#d9d4c7] bg-[#f4f1ea] px-1 py-0.5 font-mono text-[10px] dark:border-[#3d3830] dark:bg-[#1c1a17]">↑</kbd>
                  <kbd className="rounded border border-[#d9d4c7] bg-[#f4f1ea] px-1 py-0.5 font-mono text-[10px] dark:border-[#3d3830] dark:bg-[#1c1a17]">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-[#d9d4c7] bg-[#f4f1ea] px-1 py-0.5 font-mono text-[10px] dark:border-[#3d3830] dark:bg-[#1c1a17]">↵</kbd>
                  to select
                </span>
              </div>
              <span className="font-ui text-[10px] text-[#6b6358] dark:text-[#9a9080]">
                Quaesitor Command Palette
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget
  );
}
