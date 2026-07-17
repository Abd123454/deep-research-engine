"use client";
import * as Sentry from "@sentry/nextjs";

// HistoryDrawer — slide-in panel from the right showing past sessions.
// Replaces the old HistoryMode tab. Users click a session to load it.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Search,
  FileText,
  Zap,
  History as HistoryIcon,
  Loader2,
} from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { SessionType } from "@/lib/session-store";

interface SessionSummary {
  id: string;
  type: SessionType;
  title: string;
  summary: string | null;
  status: string;
  createdAt: string;
}

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (session: { id: string; type: SessionType; title: string; content: string | null }) => void;
}

const TYPE_ICON: Record<SessionType, React.ComponentType<{ className?: string }>> = {
  research: Search,
  document_qa: FileText,
  quick: Zap,
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function HistoryDrawer({ open, onClose, onSelect }: HistoryDrawerProps) {
  const t = useT();
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const loadList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */
    
} finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  async function handleSelect(s: SessionSummary) {
    setLoadingId(s.id);
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const data = await res.json();
        onSelect({
          id: s.id,
          type: s.type,
          title: s.title,
          content: data.session?.content || null,
        });
        onClose();
      }
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */
    
} finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      await loadList();
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */
    
}
  }

  async function handleClearAll() {
    if (!confirm(t("confirmDeleteAll"))) return;
    try {
      await fetch("/api/sessions", { method: "DELETE" });
      await loadList();
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */
    
}
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-[#faf9f5] dark:bg-[#1a1a18] border-l border-[#e8e6dc] dark:border-[#3d3a35] flex flex-col"
            role="dialog"
            aria-label={t("historyPlaceholder")}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#e8e6dc]/60 dark:border-[#3d3a35]/60">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-[#c96442]" />
                {t("historyPlaceholder")}
              </h2>
              <div className="flex items-center gap-1">
                {sessions.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-[#c44848] hover:text-[#c44848] px-3 py-1.5 rounded-md hover:bg-[#c44848]/5 transition-colors"
                  >
                    {t("clearAllSessions")}
                  </button>
                )}
                <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#5e5d59] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#87867f] dark:text-[#a3a098]" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <HistoryIcon className="h-8 w-8 text-[#87867f]/40 mx-auto mb-3" />
                  <p className="text-sm text-[#87867f] dark:text-[#a3a098]">{t("noSessions")}</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const Icon = TYPE_ICON[s.type] || FileText;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      disabled={loadingId !== null}
                      className={cn(
                        "w-full text-left rounded-lg p-3 transition-colors group flex items-start gap-2 mb-1",
                        loadingId === s.id
                          ? "bg-[#c96442]/5 opacity-50"
                          : "hover:bg-[#f0eee6] dark:hover:bg-[#393937]"
                      )}
                    >
                      {loadingId === s.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-[#c96442]" />
                      ) : (
                        <Icon className="h-4 w-4 shrink-0 mt-0.5 text-[#87867f] dark:text-[#a3a098]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate text-[#141413] dark:text-[#faf9f5]">{s.title}</p>
                        {s.summary && (
                          <p className="text-[10px] text-[#87867f] dark:text-[#a3a098] truncate">{s.summary}</p>
                        )}
                        <p className="text-[9px] text-[#87867f]/60 mt-0.5">{fmtDate(s.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        aria-label={t("deleteSession")}
                        className="opacity-0 group-hover:opacity-100 text-[#87867f] hover:text-[#c44848] transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
