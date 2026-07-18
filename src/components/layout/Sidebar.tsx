"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, MessageSquare, FileText, Zap, Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { CompassLogo } from "@/components/CompassLogo";
import { cn } from "@/lib/utils";

interface SidebarConversation {
  id: string;
  title: string;
  // `type` is optional because the conversations table doesn't store a
  // per-conversation type (the sessions table does, but the Sidebar is
  // now backed by /api/chat/conversations which returns rows from the
  // conversations table — see P0-4 in UnifiedInterface). When omitted,
  // the Sidebar falls back to the chat icon. Callers that have the
  // type (e.g. from /api/sessions) can still pass it.
  type?: "chat" | "research" | "quick" | "document";
  createdAt: string;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  conversations: SidebarConversation[];
  activeId?: string;
}

const TYPE_ICON = {
  chat: MessageSquare,
  research: FileText,
  quick: Zap,
  document: FileText,
};

function timeGroup(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 86400000;
  if (diff < day && d.getDate() === new Date().getDate()) return "Today";
  if (diff < day * 2) return "Yesterday";
  if (diff < day * 7) return "Last 7 days";
  return "Older";
}

export const Sidebar = React.memo(function Sidebar({
  open, onClose, onNewChat, onSelectConversation, conversations, activeId,
}: SidebarProps) {
  const [search, setSearch] = React.useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const groups = filtered.reduce<Record<string, SidebarConversation[]>>((acc, c) => {
    const g = timeGroup(c.createdAt);
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  const groupOrder = ["Today", "Yesterday", "Last 7 days", "Older"];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            // Mobile: fixed drawer overlaying content (z-50, above the
            // backdrop at z-40). Desktop: static flex item taking 280px
            // in the layout — the drawer animation still works because
            // `lg:static` overrides `fixed`.
            className="flex h-full w-[280px] flex-col border-r border-[#d9d4c7] bg-[#f4f1ea] dark:border-[#3d3830] dark:bg-[#1c1a17] z-50 fixed lg:static inset-y-0 left-0"
          >
            <div className="flex h-14 items-center gap-2 px-4 shrink-0">
              <CompassLogo className="h-5 w-5 fill-[#8b4513] text-[#8b4513]" />
              <span className="font-body text-lg font-semibold text-[#2a2620] dark:text-[#e8e3d8]">
                Quaesitor
              </span>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 ml-auto lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* New Chat button — terracotta fill, rounded-lg (8px), sans font, clay in dark mode */}
            <div className="shrink-0 px-3">
              <button
                onClick={onNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b4513] dark:bg-[#b5673a] px-3 py-2 font-ui text-sm font-medium text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513] transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <div className="shrink-0 px-3 mt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6358]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-[#d9d4c7]/50 dark:bg-[#322e28]/50 border-0 rounded-lg pl-9 pr-3 py-2 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] outline-none focus:ring-2 focus:ring-[#8b4513]/20"
                  style={{ boxShadow: "none", minHeight: "auto" }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 mt-1">
              {filtered.length === 0 ? (
                <p className="font-ui text-xs text-[#6b6358] text-center py-8">
                  {search ? "No matches found." : "No conversations yet."}
                </p>
              ) : (
                groupOrder.map((group) => {
                  const items = groups[group];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="font-ui text-xs font-medium text-[#6b6358] uppercase tracking-wider px-3 mb-1">
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {items.map((c) => {
                          const Icon = TYPE_ICON[c.type || "chat"] || MessageSquare;
                          return (
                            <button
                              key={c.id}
                              onClick={() => onSelectConversation(c.id)}
                              className={cn(
                                "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors group",
                                activeId === c.id ? "bg-[#2a2620]/5 dark:bg-[#e8e3d8]/5" : "hover:bg-[#2a2620]/5 dark:hover:bg-[#e8e3d8]/5"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 text-[#6b6358]" />
                              <span className="font-body text-sm text-[#2a2620] dark:text-[#e8e3d8] truncate flex-1">{c.title}</span>
                              <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-[#6b6358] hover:text-[#a33a3a] transition-opacity shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-[#d9d4c7] dark:border-[#3d3830] p-3 flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
                <Settings className="h-4 w-4 text-[#6b6358] dark:text-[#9a9080]" />
              </Button>
              <div className="flex items-center gap-1">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
});
