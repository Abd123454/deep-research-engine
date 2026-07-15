"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, MessageSquare, FileText, Zap, Settings,
  X, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { cn } from "@/lib/utils";

interface SidebarConversation {
  id: string;
  title: string;
  type: "chat" | "research" | "quick" | "document";
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
            className="fixed lg:static inset-y-0 left-0 z-50 w-[250px] shrink-0 flex flex-col border-r border-border bg-background"
          >
            <div className="shrink-0 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold">Deep Research</span>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="shrink-0 px-3">
              <Button onClick={onNewChat} className="w-full gap-2 rounded-xl" size="sm">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            <div className="shrink-0 px-3 mt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-lg border border-border bg-secondary/50 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 mt-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {search ? "No matches found." : "No conversations yet."}
                </p>
              ) : (
                groupOrder.map((group) => {
                  const items = groups[group];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-2 mb-1">
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {items.map((c) => {
                          const Icon = TYPE_ICON[c.type] || MessageSquare;
                          return (
                            <button
                              key={c.id}
                              onClick={() => onSelectConversation(c.id)}
                              className={cn(
                                "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors group",
                                activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-xs truncate flex-1">{c.title}</span>
                              <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-border p-3 flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
                <Settings className="h-4 w-4 text-muted-foreground" />
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
