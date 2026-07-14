"use client";

// HistoryMode — persisted sessions list + viewer.
//
// Shows all completed research, document Q&A, and quick ask sessions.
// Click a session to view its full content. Delete individual sessions
// or clear all. Sessions persist across refreshes via SQLite.

import * as React from "react";
import { motion } from "framer-motion";
import {
  History as HistoryIcon,
  Trash2,
  Search,
  FileText,
  Zap,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";
import type { SessionType } from "@/lib/session-store";

interface SessionSummary {
  id: string;
  type: SessionType;
  title: string;
  summary: string | null;
  status: string;
  createdAt: string;
}

interface FullSession extends SessionSummary {
  content: string | null;
  metadata: string | null;
}

const TYPE_ICON: Record<SessionType, React.ComponentType<{ className?: string }>> = {
  research: Search,
  document_qa: FileText,
  quick: Zap,
};

const TYPE_LABEL_KEY: Record<SessionType, "sessionResearch" | "sessionDocQA" | "sessionQuick"> = {
  research: "sessionResearch",
  document_qa: "sessionDocQA",
  quick: "sessionQuick",
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function HistoryMode() {
  const t = useT();
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [fullSession, setFullSession] = React.useState<FullSession | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingSession, setLoadingSession] = React.useState(false);

  const loadList = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  async function loadSession(id: string) {
    setSelectedId(id);
    setFullSession(null);
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFullSession(data.session);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingSession(false);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (selectedId === id) {
        setSelectedId(null);
        setFullSession(null);
      }
      await loadList();
    } catch {
      /* ignore */
    }
  }

  async function clearAll() {
    if (!confirm(t("confirmDeleteAll"))) return;
    try {
      await fetch("/api/sessions", { method: "DELETE" });
      setSelectedId(null);
      setFullSession(null);
      await loadList();
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t("historyPlaceholder")}
        </h2>
        {sessions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            {t("clearAllSessions")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session list */}
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 p-8 text-center">
              <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
            </div>
          ) : (
            sessions.map((s) => {
              const Icon = TYPE_ICON[s.type] || FileText;
              return (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={cn(
                    "w-full text-left rounded-lg p-3 transition-colors group flex items-start gap-2",
                    selectedId === s.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent border border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{s.title}</p>
                    {s.summary && (
                      <p className="text-[10px] text-muted-foreground truncate">{s.summary}</p>
                    )}
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {t(TYPE_LABEL_KEY[s.type] || "sessionResearch")} · {fmtDate(s.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    aria-label={t("deleteSession")}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              );
            })
          )}
        </div>

        {/* Session viewer */}
        <div className="md:col-span-2">
          {!selectedId ? (
            <div className="rounded-2xl border border-border/40 p-12 text-center">
              <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">{t("sessionContent")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("historyDesc")}</p>
            </div>
          ) : loadingSession ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : fullSession ? (
            <div className="rounded-2xl border border-border/60 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {(() => {
                  const Icon = TYPE_ICON[fullSession.type] || FileText;
                  return <Icon className="h-4 w-4 text-primary" />;
                })()}
                <span className="text-sm font-semibold truncate">{fullSession.title}</span>
                {fullSession.content && (
                  <div className="ml-auto">
                    <ExportMenu
                      content={fullSession.content}
                      filename={`session-${fullSession.id.slice(0, 8)}`}
                    />
                  </div>
                )}
              </div>
              {fullSession.summary && (
                <p className="text-xs text-muted-foreground mb-4">{fullSession.summary}</p>
              )}
              <div className="text-[10px] text-muted-foreground/60 mb-4">
                {t(TYPE_LABEL_KEY[fullSession.type] || "sessionResearch")} · {fmtDate(fullSession.createdAt)}
              </div>
              {fullSession.content ? (
                <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown>{fullSession.content}</ReactMarkdown>
                </article>
              ) : (
                <p className="text-sm text-muted-foreground italic">No content saved.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
